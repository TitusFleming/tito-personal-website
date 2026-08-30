import PostShell, { DemoFrame, Prose } from "../post-shell";

export const metadata = {
  title: "How Machines Learn | Tito Fleming",
  description: "Part 2 of The Fundamentals of AI: gradient descent, by feel.",
};

export default function Page() {
  return (
    <PostShell part={2}>
      <Prose>
        <p>
          In the last post I trained a model and skipped the biggest question: where did
          its 7,840 weights come from? I did not choose them. An algorithm called
          gradient descent found them, and the easiest way I know to explain it is a
          marble rolling on hills. The marble follows one rule: roll downhill. Below is a
          landscape you can try that rule on. Press Drop ball and watch where it ends up.
        </p>
      </Prose>

      <DemoFrame part={2} />

      <Prose>
        <p>
          The ball rolls into the nearest dip and stops there. Usually that dip is not
          the lowest point on the map. Turn on &ldquo;reveal global minimum&rdquo; and
          you will see a deeper valley somewhere else, one the ball can never reach on
          its own, because getting there would mean rolling uphill first. This is called
          getting stuck in a local minimum, and it is the classic failure of gradient
          descent.
        </p>
        <p>
          The fix sounds too simple to work: shake the ground. A random kick can knock a
          stuck ball over a ridge, and a ball that is already in the deepest valley
          usually just falls back in, so randomness hurts bad answers more than good
          ones. Shaking hard at first and more gently over time is a real method called
          simulated annealing, and it is exactly what the Auto-anneal button does.
        </p>
        <p>
          The two sliders are real vocabulary too. Learning rate is how hard the slope
          pushes the ball. Momentum lets the ball keep its speed, so it can coast through
          small bumps instead of stopping in every tiny dent.
        </p>
        <p>
          Here is the connection back to part 1. The landscape is not a real place. The
          two directions of the floor are two of the model&rsquo;s weights, and the
          height at every point is how wrong the model would be with the weights set that
          way. The ball&rsquo;s position is a model. Rolling downhill is training. When
          the ball finally rests somewhere low, its coordinates are the trained weights.
          The stencils from part 1 are just where a ball stopped rolling, in a version of
          this game with 7,840 dimensions instead of 2.
        </p>
      </Prose>
    </PostShell>
  );
}
