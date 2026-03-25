import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.update({
      where: { email: 'simongatungo300@gmail.com' },
      data: { isAdmin: true },
    });
    console.log('User updated successfully:', user.email);
  } catch (err) {
    if (err.code === 'P2025') {
      console.log('User not found. Skipping admin update.');
    } else {
      console.error('Error updating user:', err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
