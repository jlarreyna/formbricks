import { describe, expect, test } from "vitest";
import { escapeHtml, interpolateTemplate } from "./template";

describe("escapeHtml", () => {
  test("escapes reserved HTML characters", () => {
    expect(escapeHtml(`<a href="x">&'"</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&quot;&lt;/a&gt;");
  });
});

describe("interpolateTemplate", () => {
  test("replaces scalar placeholders and escapes their values", () => {
    const result = interpolateTemplate("<p>Hello {{nombre}}</p>", {
      scalars: { nombre: "<Alice>" },
    });

    expect(result).toBe("<p>Hello &lt;Alice&gt;</p>");
  });

  test("injects raw placeholders without escaping", () => {
    const result = interpolateTemplate("<div>{{survey}}</div>", {
      scalars: {},
      raw: { survey: "<button>Answer</button>" },
    });

    expect(result).toBe("<div><button>Answer</button></div>");
  });

  test("replaces unknown placeholders with an empty string", () => {
    const result = interpolateTemplate("Hi {{missing}}!", { scalars: {} });
    expect(result).toBe("Hi !");
  });

  test("prefers raw over scalar for the same key", () => {
    const result = interpolateTemplate("{{survey}}", {
      scalars: { survey: "escaped" },
      raw: { survey: "<b>raw</b>" },
    });

    expect(result).toBe("<b>raw</b>");
  });

  test("supports survey_link as an escaped scalar", () => {
    const result = interpolateTemplate('<a href="{{survey_link}}">Open</a>', {
      scalars: { survey_link: "https://example.com/c/token?a=1&b=2" },
    });

    expect(result).toBe('<a href="https://example.com/c/token?a=1&amp;b=2">Open</a>');
  });
});
