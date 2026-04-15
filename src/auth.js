import bcrypt from "bcryptjs";
import { getPrisma } from "./db.js";

export async function verifyLogin(email, password) {
  const prisma = getPrisma();
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? { id: user.id, email: user.email } : null;
}

export function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.redirect("/admin/login");
}

