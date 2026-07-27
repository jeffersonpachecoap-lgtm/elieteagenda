# Eliete Agenda Semestral

Agenda virtual responsiva de julho a dezembro de 2026, com salvamento compartilhado no Supabase e alarme por voz no navegador.

## Configuração

1. No Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute.
2. Na Vercel, importe este repositório.
3. Em **Settings → Environment Variables**, crie:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AGENDA_EDIT_PIN`
4. Faça um novo deploy.

Nunca publique a chave `SUPABASE_SERVICE_ROLE_KEY` no GitHub. Ela deve existir somente nas variáveis protegidas da Vercel.

O alarme por voz funciona enquanto o site estiver aberto no navegador. O visitante precisa ativá-lo uma vez em cada aparelho e permitir notificações.
