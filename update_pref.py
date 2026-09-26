import re

with open('src/app/settings/PreferencesForm.tsx', 'r') as f:
    c = f.read()

# Update function signature
c = re.sub(
    r'initialUseEmojiTitle, initialEmojiModifier, initialUnitSystem }: { initialBedtime: string, initialWeekStartsOn: string, initialUseEmojiTitle: boolean, initialEmojiModifier: string, initialUnitSystem: string }',
    r'initialUseEmojiTitle, initialUnitSystem }: { initialBedtime: string, initialWeekStartsOn: string, initialUseEmojiTitle: boolean, initialUnitSystem: string }',
    c
)

# Remove state
c = re.sub(r"  const \[emojiModifier, setEmojiModifier\] = useState\(initialEmojiModifier \|\| ''\);\n", '', c)

# Update handleSave call
c = re.sub(r'useEmojiTitle, emojiModifier, unitSystem', r'useEmojiTitle, unitSystem', c)

# Update hasChanges
c = re.sub(r' \|\| emojiModifier !== initialEmojiModifier', '', c)

# Remove the block: {useEmojiTitle && ( ... )}
block_to_remove = """      {useEmojiTitle && (
        <div className="pl-7 animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-semibold text-stone-700 mb-1">Emoji Style / Modifiers (Optional)</label>
          <p className="text-sm text-stone-500 mb-3">
            Specify preferred skin tone, gender, or theme (e.g. "female, medium skin tone").
          </p>
          <input 
            type="text" 
            value={emojiModifier}
            onChange={e => setEmojiModifier(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="e.g. female, medium skin tone"
          />
        </div>
      )}

"""
c = c.replace(block_to_remove, '')

with open('src/app/settings/PreferencesForm.tsx', 'w') as f:
    f.write(c)
