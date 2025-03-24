import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
/**
 * Service to manage user roles in local storage.
 */
export class RoleService {
  /**
   * Retrieves the user role from local storage.
   * @returns The user role or null if not found.
   */
  getRole(): Role | null {
    return window.localStorage.getItem("role") as Role | null;
  }

  /**
   * Sets the user role in local storage.
   * @param role The user role to set.
   */
  setRole(role: Role): void {
    window.localStorage.setItem("role", role);
  }

  /**
   * Removes the user role from local storage.
   */
  destroyRole(): void {
    window.localStorage.removeItem("role");
  }
}

export type Role = 'admin' | 'partner';