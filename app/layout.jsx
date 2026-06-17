// Layout raíz requerido por Next.js (App Router).
export const metadata = {
  title: "Gestor Personal",
  description: "App personal modular: objetivos, economía, hábitos, tenis y diario.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
