# Edge Function: submit-asesoramiento

Secrets requeridos:

- `SUPABASE_SERVICE_ROLE_KEY` (si no viene inyectada)
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_TEAM`
- `SITE_URL`
- `LOGO_URL` (opcional)

Deploy:

```bash
supabase functions deploy submit-asesoramiento --no-verify-jwt
```
