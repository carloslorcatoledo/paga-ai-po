/*
 * Configuración de Supabase.
 * La "publishable key" es PÚBLICA a propósito: puede ir en el cliente. La
 * seguridad la hacen las políticas RLS definidas en esquema-supabase.sql.
 * (La llave secreta "sb_secret_..." NUNCA va aquí.)
 */
window.SUPABASE_CONFIG = {
  url: 'https://mctvxmuqvlszmmefamfb.supabase.co',
  publishableKey: 'sb_publishable_Utd4upxRUmQSs7jd9_TjyQ_rqu8H7ti'
};
