/** Geometry-Dash-flavoured menu backdrop.
 *
 *  Deliberately NOT Geometry Dash's art — RobTop's textures are copyrighted
 *  and this is a public site. What's borrowed is the grammar: a slow diagonal
 *  lattice, a faster-scrolling ground strip for parallax, and cubes tumbling
 *  across. Drawn from the site's own palette.
 *
 *  No "use client", no state, no canvas: every moving part is a CSS animation
 *  on transform or background-position, so this ships zero JavaScript and the
 *  compositor does the work. The cube configs are hand-varied rather than
 *  randomised, which looks the same and avoids a hydration mismatch.
 */

const CUBES = [
  { top: 8, size: 38, duration: 46, delay: -2, spin: 1 },
  { top: 21, size: 24, duration: 61, delay: -19, spin: -1 },
  { top: 34, size: 52, duration: 38, delay: -31, spin: 1 },
  { top: 47, size: 30, duration: 55, delay: -8, spin: -1 },
  { top: 58, size: 44, duration: 43, delay: -25, spin: 1 },
  { top: 69, size: 26, duration: 66, delay: -40, spin: -1 },
  { top: 15, size: 30, duration: 52, delay: -35, spin: -1 },
  { top: 41, size: 36, duration: 71, delay: -12, spin: 1 },
  { top: 76, size: 34, duration: 49, delay: -48, spin: 1 },
];

export default function GdBackground() {
  return (
    <div className="gd-bg" aria-hidden="true">
      <div className="gd-lattice" />
      <div className="gd-cubes">
        {CUBES.map((cube, i) => (
          <div
            key={i}
            className="gd-cube"
            style={
              {
                "--top": `${cube.top}%`,
                "--size": `${cube.size}px`,
                "--duration": `${cube.duration}s`,
                "--delay": `${cube.delay}s`,
                "--spin": String(cube.spin),
              } as React.CSSProperties
            }
          >
            <span className="gd-cube-eye" />
            <span className="gd-cube-eye" />
          </div>
        ))}
      </div>
      <div className="gd-ground">
        <div className="gd-ground-texture" />
      </div>
    </div>
  );
}
