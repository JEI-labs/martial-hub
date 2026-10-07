'use client';

export const Footer = () => {
  return (
    <footer className="bg-background fixed bottom-0 left-0 flex w-full items-center justify-between p-4 px-8 text-sm text-gray-400 sm:px-16">
      <span className="whitespace-nowrap">
        © {new Date().getFullYear()} Exchange
      </span>
      <div className="flex max-sm:flex-col sm:space-x-4">
        <a href="#" className="whitespace-nowrap hover:underline">
          Central de Ajuda
        </a>
        <span className="hidden sm:inline">•</span>
        <a href="#" className="whitespace-nowrap hover:underline">
          Termos de Uso
        </a>
        <span className="hidden sm:inline">•</span>
        <a href="#" className="whitespace-nowrap hover:underline">
          Política de Privacidade
        </a>
      </div>
    </footer>
  );
};
