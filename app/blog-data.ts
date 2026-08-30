export type BlogPost = {
  part: number;
  slug: string;
  title: string;
  meta: string;
  blurb: string;
  status: "draft" | "published";
};

export const BLOG_SERIES = {
  title: "The Fundamentals of AI",
  tagline:
    "I think these ideas are much easier to understand visually than by reading about them. Each post here pairs a short explanation with something you can play with.",
  posts: [
    {
      part: 1,
      slug: "everything-is-a-function",
      title: "Everything Is a Function",
      meta: "Part 1 · How machines see",
      blurb:
        "I built a page where you draw a digit and a small neural network I trained guesses what you wrote. The post explains every step the model takes to do that.",
      status: "draft",
    },
    {
      part: 2,
      slug: "how-machines-learn",
      title: "How Machines Learn",
      meta: "Part 2 · Gradient descent",
      blurb:
        "I built a 3D landscape you can drop a ball onto. This is a visualization of gradient descent which is the technique most models use to learn.",
      status: "draft",
    },
    {
      part: 3,
      slug: "everything-is-a-prediction",
      title: "Everything Is a Prediction",
      meta: "Part 3 · From digits to language",
      blurb:
        "I built a tiny language model that learned from a single book. You write with it by tapping suggestions, and a memory slider shows why real models like ChatGPT have to work differently.",
      status: "draft",
    },
  ] satisfies BlogPost[],
};
