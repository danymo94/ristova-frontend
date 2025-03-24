import { Injectable } from "@angular/core";
import {jwtDecode} from "jwt-decode";

@Injectable({ providedIn: "root" })
/**
 * Service to manage JWT tokens in local storage.
 */
export class JwtService {
  /**
   * Retrieves the JWT token from local storage.
   * @returns The JWT token or null if not found.
   */
  getToken(): string | null {
    return window.localStorage.getItem("token");
  }

  /**
   * Saves the JWT token in local storage.
   * @param token The JWT token to save.
   */
  saveToken(token: string): void {
    window.localStorage.setItem("token", token);
  }

  /**
   * Removes the JWT token from local storage.
   */
  destroyToken(): void {
    window.localStorage.removeItem("token");
  }

  /**
   * Decodes the JWT token.
   * @param token The JWT token to decode.
   * @returns The decoded token.
   */
  decodeToken(token: string): any {
    return jwtDecode(token);
  }
}