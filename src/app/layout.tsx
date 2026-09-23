import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Комплект AI — помощник по закупкам",
  description:
    "Прототип помощника для подбора электротехнических товаров по каталогу ekt.kz. Проект команды Zhigitter на HackAlem AI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
