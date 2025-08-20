export const flags = {
  showWalletUI: (import.meta.env.VITE_SHOW_WALLET_UI ?? 'false') === 'true',
  requireWalletForPlayback: (import.meta.env.VITE_REQUIRE_WALLET_FOR_PLAYBACK ?? 'false') === 'true',
};