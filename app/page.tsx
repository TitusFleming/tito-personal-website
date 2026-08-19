import GdBackground from "./gd-background";
import MainMenu from "./main-menu";

export default function Home() {
  return (
    <main className="min-h-screen menu-main text-[#181713]">
      <GdBackground />
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <MainMenu />
      </div>
    </main>
  );
}
