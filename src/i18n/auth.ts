// src/i18n/auth.ts
const messages = {
  'en-US': {
    signInTitle: 'Sign in to Reelverse',
    signInToSubscribe: 'Sign in to subscribe',
    signInToComment: 'Sign in to comment',
    phoneTab: 'Phone',
    emailTab: 'Email',
    phonePlaceholder: 'Phone number',
    emailPlaceholder: 'Email address',
    otpPlaceholder: 'Enter OTP',
    continueButton: 'Continue',
    resendIn: 'Resend in {seconds}s',
    resendNow: 'Resend now',
    secureCookieMessage: 'We set a secure cookie. No password or wallet required.',
    terms: 'Terms',
    privacy: 'Privacy',
    invalidPhone: 'Invalid phone number',
    invalidEmail: 'Invalid email address',
    invalidOtp: 'Invalid OTP',
    sending: 'Sending...',
    verifying: 'Verifying...',
  },
  'es-ES': {
    signInTitle: 'Iniciar sesión en Reelverse',
    signInToSubscribe: 'Iniciar sesión para suscribirse',
    signInToComment: 'Iniciar sesión para comentar',
    phoneTab: 'Teléfono',
    emailTab: 'Correo electrónico',
    phonePlaceholder: 'Número de teléfono',
    emailPlaceholder: 'Dirección de correo electrónico',
    otpPlaceholder: 'Ingresar OTP',
    continueButton: 'Continuar',
    resendIn: 'Reenviar en {seconds}s',
    resendNow: 'Reenviar ahora',
    secureCookieMessage: 'Establecemos una cookie segura. No se requiere contraseña ni billetera.',
    terms: 'Términos',
    privacy: 'Privacidad',
    invalidPhone: 'Número de teléfono inválido',
    invalidEmail: 'Dirección de correo electrónico inválida',
    invalidOtp: 'OTP inválido',
    sending: 'Enviando...',
    verifying: 'Verificando...',
  },
  'pt-BR': {
    signInTitle: 'Entrar no Reelverse',
    signInToSubscribe: 'Entrar para assinar',
    signInToComment: 'Entrar para comentar',
    phoneTab: 'Teléfono',
    emailTab: 'E-mail',
    phonePlaceholder: 'Número de telefone',
    emailPlaceholder: 'Endereço de e-mail',
    otpPlaceholder: 'Inserir OTP',
    continueButton: 'Continuar',
    resendIn: 'Reenviar em {seconds}s',
    resendNow: 'Reenviar agora',
    secureCookieMessage: 'Definimos um cookie seguro. Nenhuma senha ou carteira é necessária.',
    terms: 'Termos',
    privacy: 'Privacidade',
    invalidPhone: 'Número de telefone inválido',
    invalidEmail: 'Endereço de e-mail inválido',
    invalidOtp: 'OTP inválido',
    sending: 'Enviando...',
    verifying: 'Verificando...',
  },
};

export const getLang = () => {
  const lang = navigator.language || 'en-US';
  if (messages[lang]) {
    return messages[lang];
  }
  // Fallback to a more general language if specific locale not found
  const generalLang = lang.split('-')[0];
  if (messages[`${generalLang}-US`]) { // e.g., 'es' -> 'es-US'
    return messages[`${generalLang}-US`];
  }
  return messages['en-US']; // Default fallback
};
