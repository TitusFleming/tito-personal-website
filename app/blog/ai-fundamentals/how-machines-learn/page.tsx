import PostShell, { Bubble, DemoFrame } from "../post-shell";

export const metadata = {
  title: "How Machines Learn | Tito Fleming",
  description: "Part 2 of The Fundamentals of AI: gradient descent, by feel.",
};

export default function Page() {
  return (
    <PostShell part={2}>
      <Bubble kicker="the setup">
        <p>
          Gradient descent is the algorithm behind nearly all current machine learning,
          and it is really just a fancy way of rolling a ball downhill. The terrain
          below is a loss landscape. Drop a ball and try to get it to the global
          minimum.
        </p>
      </Bubble>

      <DemoFrame part={2} />

      <Bubble kicker="the local minimum">
        <p>
          The ball rolls into a dip and stops, and it is usually not the deepest one.
          Turn on &ldquo;reveal global minimum&rdquo; and a better valley is often one
          ridge away. The ball cannot reach it, because the route runs uphill first.
        </p>
        <p>
          Settling for the first valley it finds is called a local minimum, and it is the
          central problem of the entire field.
        </p>
      </Bubble>

      <Bubble kicker="noise as the fix">
        <p>
          Shake the ground. A stuck ball plus a random kick can clear the ridge, while a
          ball already in the deepest valley tends to fall straight back in. Randomness
          damages bad answers more than good ones.
        </p>
        <p>
          Applied on a schedule that starts strong and cools off, this is called
          simulated annealing. That is the Auto-anneal button.
        </p>
      </Bubble>

      <Bubble kicker="the two sliders">
        <p>
          Learning rate sets how hard the slope pushes the ball. Momentum makes it heavy
          enough to coast through small bumps. Both terms appear in essentially every
          machine learning paper, and both mean exactly what they mean here.
        </p>
      </Bubble>

      <Bubble kicker="why this is learning">
        <p>
          The landscape is not a place. Its two floor directions are two of the weights
          from part 1, and the height at any point is how wrong the model is with the
          weights set that way. The ball&rsquo;s position is the model. Rolling downhill
          is learning.
        </p>
        <p>
          The stencils from part 1 mark where a ball came to rest, in a version of this
          game with 7,840 dimensions.
        </p>
      </Bubble>
    </PostShell>
  );
}
