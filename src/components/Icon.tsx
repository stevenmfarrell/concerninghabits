import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';

export default function Icon({ name, ...props }: { name: string } & LucideProps) {
  const LucideIcon = (Icons as any)[name] || Icons.List;
  return <LucideIcon {...props} />;
}
