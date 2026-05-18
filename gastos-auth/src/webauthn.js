// Thin wrappers around @simplewebauthn/server. All ceremonies bind to the
// frontend origin (env.FRONTEND_ORIGIN) and rpID (env.RP_ID); these are what
// each passkey is locked to at registration.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// Single-user app, so the WebAuthn "user" is a constant. WebAuthn supports
// multiple credentials per user — that's how you register additional devices.
const USER_ID = new TextEncoder().encode('gastos-user');
const USER_NAME = 'gastos';

export async function registrationOptions(env, excludeCredentials = []) {
  return generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userID: USER_ID,
    userName: USER_NAME,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      // No authenticatorAttachment constraint — lets iOS use any passkey
      // provider the user has configured (iCloud Keychain, 1Password, etc.).
      // Face ID is still the unlock step regardless of provider.
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });
}

export async function verifyRegistration(env, response, expectedChallenge) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.FRONTEND_ORIGIN,
    expectedRPID: env.RP_ID,
    requireUserVerification: true,
  });
}

export async function authenticationOptions(env, allowCredentials = []) {
  return generateAuthenticationOptions({
    rpID: env.RP_ID,
    allowCredentials,
    userVerification: 'required',
  });
}

export async function verifyAuthentication(env, response, expectedChallenge, credential) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.FRONTEND_ORIGIN,
    expectedRPID: env.RP_ID,
    credential,
    requireUserVerification: true,
  });
}
