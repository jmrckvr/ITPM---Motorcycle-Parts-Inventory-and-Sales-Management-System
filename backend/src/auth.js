import "dotenv/config";
import jwt from "jsonwebtoken";
import { db, userView } from "./db.js";

const secret = process.env.JWT_SECRET || "development-secret-change-me";

export function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, {
    expiresIn: "8h",
  });
}

export async function requireAuth(request, response, next) {
  const token = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : null;
  if (!token) return response.status(401).json({ message: "Unauthenticated." });
  try {
    const payload = jwt.verify(token, secret);
    const user = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(payload.sub);
    if (!user || user.is_active === 0)
      return response.status(401).json({ message: "Unauthenticated." });
    request.user = userView(user);
    return next();
  } catch {
    return response.status(401).json({ message: "Unauthenticated." });
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== "admin")
    return response.status(403).json({ message: "Forbidden." });
  return next();
}

export function requireRole(...roles) {
  return (request, response, next) =>
    roles.includes(request.user?.role)
      ? next()
      : response.status(403).json({ message: "Forbidden." });
}
