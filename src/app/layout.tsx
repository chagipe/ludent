import './globals.css';
export const metadata = { title: 'Ludent · Sistema de gestión' };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
