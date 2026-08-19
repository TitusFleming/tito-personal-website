import MainMenu from "./main-menu";

export default function Home() {
  return (
    <main className="min-h-screen text-[#181713]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <MainMenu />

        <footer>
          <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
          <a href="https://www.richard-fleming.com">richard-fleming.com</a>
          <a
            href="https://www.linkedin.com/in/tito-fleming/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </footer>
      </div>
    </main>
  );
}
