import { Injectable } from '@angular/core';
import { NativeBiometric } from 'capacitor-native-biometric';

@Injectable({
  providedIn: 'root'
})
export class BiometricService {

  constructor() { }

  async checkBiometricAvailability(): Promise<boolean> {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch (e) {
      return false;
    }
  }

  // Ahora guardamos la CONTRASEÑA real
  async saveCredentials(email: string, contrasenia: string): Promise<void> {
    await NativeBiometric.setCredentials({
      username: email,
      password: contrasenia, 
      server: 'wearebank.app', 
    });
  }

  async getCredentials(): Promise<{ email: string, contrasenia: string } | null> {
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: 'wearebank.app',
      });
      return {
        email: credentials.username,
        contrasenia: credentials.password 
      };
    } catch (error) {
      return null;
    }
  }
  
  async deleteCredentials(): Promise<void> {
    await NativeBiometric.deleteCredentials({
      server: 'wearebank.app',
    });
  }
}