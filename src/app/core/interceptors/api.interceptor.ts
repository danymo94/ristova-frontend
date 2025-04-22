import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RoleService } from '../services/role.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const roleService = inject(RoleService);
  const role = roleService.getRole();
  const apiUrl = role
    ? `http://localhost:8000/api/${role}`
    : 'http://localhost:8000/api/public';

  const apiReq = req.clone({ url: `${apiUrl}${req.url}` });
  return next(apiReq);
};
