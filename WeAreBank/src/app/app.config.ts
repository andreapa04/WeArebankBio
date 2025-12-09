import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';

// 🔹 INTERCEPTOR: Redirige las peticiones /api a AWS
const baseUrlInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const serverUrl = 'https://wearebnk.site'; 
  
  if (req.url.startsWith('/api')) {
    const newReq = req.clone({
      url: `${serverUrl}${req.url}`
    });
    return next(newReq);
  }
  
  return next(req);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    // 🔹 Registramos el interceptor aquí
    provideHttpClient(
      withFetch(), 
      withInterceptors([baseUrlInterceptor]) 
    )
  ]
};