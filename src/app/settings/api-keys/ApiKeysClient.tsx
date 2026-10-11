'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, NotebookPen, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { PANE_INSET, PaneSection } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { INPUT_SM } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import ConfirmDialog from '@/components/ConfirmDialog';
import CopyField from '@/components/CopyField';
import { makeApiKey, revokeApiKey, setApiKeyPermissions } from '@/app/actions/apiKeys';
import { fuzzyDays } from '@/lib/format';
import { DAY_MS } from '@/lib/timezone';
import type { ApiPermissions } from '@/lib/apiKeys';

type ApiKeyRow = ApiPermissions & { id: string; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null };

// When a key was last used, roughly, e.g. "Used today", "Used 3 days ago", "Never used"
function describeUse(lastUsedAt: Date | null) {
  if (!lastUsedAt) return 'Never used';
  const days = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / DAY_MS);
  if (days < 1) return 'Used today';
  const { count, unit } = fuzzyDays(days);
  return `Used ${count} ${unit} ago`;
}

// What a key may do, in words, e.g. "Logs and reads"
function describePermissions({ canLog, canRead }: ApiPermissions) {
  return canLog && canRead ? 'Logs and reads' : canLog ? 'Logs only' : 'Reads only';
}

// What a key lets whoever has it do, to finish "Anyone with it can ... your habits"
function whatItCanDo({ canLog, canRead }: ApiPermissions) {
  return canLog && canRead ? 'log and read entries on' : canLog ? 'log entries to' : 'read entries on';
}

// The two switches for what a key may do. Turning one off while the other is too turns the other on,
// since a key has to be allowed something.
function PermissionToggles({ value, onChange }: { value: ApiPermissions; onChange: (value: ApiPermissions) => void }) {
  return (
    <div className="space-y-2">
      <Toggle
        icon={<NotebookPen className="w-5 h-5" />}
        title="Log entries"
        description="Add entries to your habits"
        checked={value.canLog}
        onChange={canLog => onChange({ canLog, canRead: canLog ? value.canRead : true })}
      />
      <Toggle
        icon={<Eye className="w-5 h-5" />}
        title="Read entries"
        description="See a habit's entries, including what others logged on shared ones"
        checked={value.canRead}
        onChange={canRead => onChange({ canRead, canLog: canRead ? value.canLog : true })}
      />
    </div>
  );
}

// The user's keys, each revocable and with what it may do changeable, and a last row to make a new one
export default function ApiKeysClient({ keys }: { keys: ApiKeyRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeApiKey(revoking.id);
      toast.success(`Revoked ${revoking.name}`);
      setRevoking(null);
    } catch {
      toast.error('Couldn\'t revoke the key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaneSection title="Keys">
      {keys.map(key => (
        <div key={key.id} className={`${PANE_INSET} py-3 flex items-center justify-between gap-3`}>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-ink truncate">{key.name}</span>
            <span className="text-sm text-ink-muted truncate">
              <code className="font-mono text-xs">{key.prefix}…</code> · {describePermissions(key)} · {describeUse(key.lastUsedAt)}
            </span>
          </div>
          <div className="flex items-center shrink-0">
            <IconButton onClick={() => setEditing(key)} title={`Change what ${key.name} can do`} aria-label={`Change what ${key.name} can do`}>
              <Pencil className="w-4 h-4" />
            </IconButton>
            <IconButton onClick={() => setRevoking(key)} edge="right" title={`Revoke ${key.name}`} aria-label={`Revoke ${key.name}`}>
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      ))}
      {/* The list's last row, rather than a Button, so it reads as adding to the list */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full flex items-center gap-2 pane-inset py-3 text-left text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors"
      >
        <Plus className="w-4 h-4" /> New Key
      </button>

      {creating && <NewKeyDialog onClose={() => setCreating(false)} />}
      {editing && <EditKeyDialog apiKey={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        isOpen={!!revoking}
        title="Revoke Key"
        message={`Anything using ${revoking?.name ?? 'this key'} won't be able to use it anymore. This can't be undone.`}
        confirmText="Revoke Key"
        isProcessing={busy}
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />
    </PaneSection>
  );
}

// The icon and heading a key dialog starts with
function KeyDialogHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-full shrink-0 bg-accent-soft-strong text-accent-ink">
        <Zap className="w-6 h-6" />
      </div>
      <div className="space-y-2 min-w-0">
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <p className="text-sm text-ink-muted leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// Names a key and picks what it may do (logging only, at first), makes it, then shows it this once
export function NewKeyDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<ApiPermissions>({ canLog: true, canRead: false });
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await makeApiKey(name, permissions);
      if (result.success) setKey(result.key);
      else toast.error(result.error);
    } catch {
      toast.error('Couldn\'t make the key');
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    router.refresh();
    onClose();
  };

  return (
    <Dialog label="New API Key" onClose={key ? undefined : onClose}>
      <form onSubmit={create}>
        <div className="p-6 sm:p-8 space-y-4">
          <KeyDialogHeading title="New API Key">
            {key
              ? `Copy it now: it won't be shown again. Anyone with it can ${whatItCanDo(permissions)} your habits.`
              : 'Name it after where it\'ll be used, so you know which to revoke later.'}
          </KeyDialogHeading>
          {key ? (
            <CopyField label="key" value={key} />
          ) : (
            <>
              <input
                autoFocus
                className={INPUT_SM + ' w-full'}
                placeholder="e.g. iPhone Shortcuts"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                aria-label="Key name"
              />
              <PermissionToggles value={permissions} onChange={setPermissions} />
            </>
          )}
        </div>
        <DialogFooter>
          {key ? (
            <Button type="button" onClick={done}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Make Key
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Changes what an existing key may do, taking effect on its next request
function EditKeyDialog({ apiKey, onClose }: { apiKey: ApiKeyRow; onClose: () => void }) {
  const [permissions, setPermissions] = useState<ApiPermissions>({ canLog: apiKey.canLog, canRead: apiKey.canRead });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await setApiKeyPermissions(apiKey.id, permissions);
      toast.success(`${apiKey.name}: ${describePermissions(permissions).toLowerCase()}`);
      onClose();
    } catch {
      toast.error('Couldn\'t change the key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog label={`Change ${apiKey.name}`} onClose={onClose}>
      <div className="p-6 sm:p-8 space-y-4">
        <KeyDialogHeading title={apiKey.name}>What this key can do. Apps using it are held to this from their next request.</KeyDialogHeading>
        <PermissionToggles value={permissions} onChange={setPermissions} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
