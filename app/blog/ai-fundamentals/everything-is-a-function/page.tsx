import PostShell, { Bubble, DemoFrame } from "../post-shell";

export const metadata = {
  title: "Everything Is a Function | Tito Fleming",
  description: "Part 1 of The Fundamentals of AI: how machines see.",
};

export default function Page() {
  return (
    <PostShell part={1}>
      <Bubble kicker="the setup">
        <p>
          The model below can read and identify handwritten digits. It has never seen
          anything, because it has no eyes. Each pixel of the drawing is converted to a
          number for how light or dark it is, and those numbers become the variables a
          function takes in. Draw a digit and watch the bars update while you are still
          drawing.
        </p>
      </Bubble>

      <DemoFrame part={1} />

      <Bubble kicker="the picture becomes numbers">
        <p>
          The machine&rsquo;s first step is to destroy the picture. The drawing is
          crushed into a 28 by 28 grid, and each cell becomes a brightness value between
          0 and 1. Hover over the grid: that is not a visualization of the data. That is
          the data.
        </p>
        <p>
          Press Unroll and the grid flattens into a list of 784 numbers. The layout is
          gone. The model never learns that pixel 30 sat above pixel 58, because a list
          has no &ldquo;above.&rdquo;
        </p>
      </Bubble>

      <Bubble kicker="the entire model">
        <p>
          The prediction is <code>f(x) = softmax(W·x + b)</code>, and nothing else is
          hiding behind it. Each of the 784 numbers is multiplied by a weight and summed,
          once per digit, and the largest total wins. That is 7,840 multiplications,
          which could be done with a pencil to the same result.
        </p>
        <p>
          &ldquo;The machine sees a seven&rdquo; is a metaphor. The arithmetic is not.
        </p>
      </Bubble>

      <Bubble kicker="where it breaks">
        <p>
          Shift the digit three pixels and the confidence collapses. The shape is the
          same to you, but the function receives 784 different numbers. Invert the colors
          and an 8 becomes a 3. It never learned shapes, only numbers.
        </p>
        <p>
          Note what it never says: &ldquo;I don&rsquo;t know.&rdquo; Scribble noise and
          it still answers at 94% confidence. A function always outputs numbers. There is
          no bar for doubt.
        </p>
      </Bubble>

      <Bubble kicker="what the weights look like">
        <p>
          The ten images at the bottom of the demo are the weights themselves, drawn as
          pictures. Orange marks pixels that raise a digit&rsquo;s score, blue marks
          pixels that lower it. Every drawing is scored against ten faint stencils.
        </p>
        <p>
          Nobody drew them. They were found by gradient descent, which is explained
          next, in part 2.
        </p>
      </Bubble>
    </PostShell>
  );
}
