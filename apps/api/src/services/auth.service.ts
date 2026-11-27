import type { LoginInput, RegisterInput } from "@np/shared";
import type { Db } from "../env";
import { AppError } from "../lib/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/password";
import { UserService } from "./user.service";

export class AuthService {
  private readonly users: UserService;

  constructor(db: Db) {
    this.users = new UserService(db);
  }

  async register(input: RegisterInput) {
    if (await this.users.findByEmail(input.email)) {
      throw AppError.conflict("An account with this email already exists.", { email: "This email is already registered" });
    }
    const passwordHash = await hashPassword(input.password);
    return this.users.create({ email: input.email, fullName: input.fullName, passwordHash }, ["candidate"]);
  }

  /** Same error and roughly the same timing for "no such user", "wrong password" and "deactivated". */
  async login(input: LoginInput) {
    const user = await this.users.findByEmail(input.email);
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) {
      throw new AppError(401, "invalid_credentials", "Invalid email or password.");
    }
    return user;
  }
}
