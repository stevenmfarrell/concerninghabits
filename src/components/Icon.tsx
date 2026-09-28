import * as Icons from 'lucide-react';
import { LucideIcon, LucideProps } from 'lucide-react';

const iconsByName = Icons as unknown as Record<string, LucideIcon>;

export default function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Component = iconsByName[name] || Icons.List;
  return <Component {...props} />;
}
