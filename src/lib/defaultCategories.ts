import { prisma } from './prisma';

// Given to every new account (see setupInitialAdmin and provisionUser), so there's somewhere to
// put a habit before the user has made their own categories.
const DEFAULT_CATEGORIES = [
  { name: 'Mind', icon: 'Brain' },
  { name: 'Body', icon: 'PersonStanding' },
  { name: 'Chores', icon: 'Broom' },
  { name: 'Other', icon: 'CheckSquare' },
];

export async function seedDefaultCategories(userId: string) {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.create({ data: { ...category, userId } });
  }
}
