import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/locale')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Cloudflare Workers (which TanStack Start uses by default in this environment)
        // provides geolocation info in the request object (cf property).
        // Since we are in a sandbox, we might need to check headers or fallback.
        
        const cfHeader = request.headers.get('cf-ipcountry');
        const acceptLanguage = request.headers.get('accept-language');
        
        let country = cfHeader || 'US';
        let language = 'en';
        let currency = 'USD';
        let currencySymbol = '$';
        
        if (country === 'BR' || (acceptLanguage && acceptLanguage.includes('pt'))) {
          language = 'pt-BR';
          currency = 'BRL';
          currencySymbol = 'R$';
        }
        
        return new Response(JSON.stringify({
          country,
          language,
          currency,
          currencySymbol
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
})
