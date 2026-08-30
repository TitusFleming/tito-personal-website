import PostShell, { DemoFrame, Prose } from "../post-shell";

export const metadata = {
  title: "How Machines Learn | Tito Fleming",
  description: "Part 2 of The Fundamentals of AI: gradient descent.",
};

export default function Page() {
  return (
    <PostShell part={2}>
      <Prose>
        <p>
          Previously I showed you how a basic Neural Network works, however I
          intentionally skipped a core consideration. What are the weights? Where did
          they come from. I didn&rsquo;t choose them, so what did. An algorithm called
          gradient descent found each of them, and the easiest way to understand how it
          works in my opinion is to picture a ball rolling down a hill. The marble
          follows one rule, go downhill. Below is a landscape you can try that out on.
          Press Drop ball and see what happens, you may have some trouble getting all
          the way down.
        </p>
      </Prose>

      <DemoFrame part={2} />

      <Prose>
        <p>
          The ball rolls into the lowest dip under it and stops there. Not always is
          that divot lowest point on the map. Turn on &ldquo;reveal global
          minimum&rdquo; and you will see the lowest point in case it&rsquo;s not
          readily apparent. The ball may not be able to reach that point on its own
          because the ball would first have to go uphill to get there. This is called
          getting stuck in a local minimum, and it is the classic failure of gradient
          descent.
        </p>
        <p>
          Adding some randomness or &ldquo;noise&rdquo; is one solution to this, shake
          the ground. now the ball can be knocked over a ridge. Randomness hurts bad
          answers more than good ones. Shaking hard at first and more gently over time
          is a real method called simulated annealing, and it is exactly what the
          Auto-anneal button does.
        </p>
        <p>
          The two sliders change features of the ball and the landscape. Learning rate
          is how hard the slope pushes the ball. Momentum lets the ball keep its speed,
          so it can coast through small bumps instead of stopping in on a tiny dent.
        </p>
        <p>
          The landscape here is not a real place. The two directions of the floor
          represent two of the weights from the last post, and the height at each spot
          is how wrong the model would be with its weights set to those values. Moving
          the ball changes the weights. Rolling downhill makes the model less wrong, and
          that is all training is. The real model has 7,840 weights instead of 2, so its
          landscape has 7,840 directions, which is impossible to draw but works the same
          way. The weights you saw in part 1 are just where the ball stopped.
        </p>
      </Prose>
    </PostShell>
  );
}
