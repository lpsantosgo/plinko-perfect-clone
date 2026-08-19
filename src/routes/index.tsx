import { createFileRoute } from "@tanstack/react-router";
import { PlinkoGame } from "@/components/plinko/PlinkoGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plinko — Jogo de Bolinhas com Multiplicadores" },
      {
        name: "description",
        content:
          "Jogue Plinko: escolha linhas, nível de risco e veja a bolinha cair pelos pinos até os multiplicadores.",
      },
      { property: "og:title", content: "Plinko — Jogo de Bolinhas com Multiplicadores" },
      {
        property: "og:description",
        content: "Plinko com 8 a 16 linhas, risco alto/normal/baixo e modo automático.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-board-bottom">
      <h1 className="sr-only">Plinko</h1>
      <PlinkoGame />
    </main>
  );
}
