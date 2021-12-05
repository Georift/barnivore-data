import superagent from "superagent";
import * as cheerio from "cheerio";
import Crawler from "crawler";

const wineUrls = [
  "https://www.barnivore.com/wine/0-9",
  "https://www.barnivore.com/wine",
  "https://www.barnivore.com/wine/g-l",
  "https://www.barnivore.com/wine/m-r",
  "https://www.barnivore.com/wine/s-t",
  "https://www.barnivore.com/wine/u-z",
];

const getCountOnList = async (url: string) => {
  const body = (await superagent.get(url)).text;
  const $ = cheerio.load(body);

  return $.root()
    .find("#content div:Contains(Displaying) b:nth-child(2)")
    .map((i, el) => {
      const text = (el as any).children[0].data;
      return Number(text);
    })
    .toArray() as unknown as number[];
};

const allWines: any[] = [];
let totalCount = -1;

const c = new Crawler({
  maxConnections: 10,

  headers: {
    "User-Agent":
      "https://github.com/Georift/barnivore-data - tim@wants.coffee",
  },

  // This will be called for each crawled page
  callback: function (error, res, done) {
    if (error) {
      console.log(error);
    } else {
      const $ = res.$;

      try {
        const wines = getWinesFromList($);
        allWines.push(...wines);
        console.log(`Loaded ${allWines.length} of ${totalCount} wines`);

        const nextLink = $("a[rel='next']").attr("href");

        if (nextLink) {
          c.queue("https://www.barnivore.com" + nextLink);
        }
      } catch (e) {
        console.error("caught error when on page", res.options.uri);
        console.error(e);
      }
    }
    done();
  },
});

Promise.all(wineUrls.map((url) => getCountOnList(url))).then((pageCounts) => {
  totalCount = pageCounts.flatMap((a) => a).reduce((a, b) => a + b, 0);
  console.log(
    `There are a total of ${totalCount} wines, downloading them now...`
  );
});

wineUrls.forEach((url) => {
  c.queue(url);
});

c.once("drain", () => {
  require("fs").writeFileSync(
    "./data/wine-listing.json",
    JSON.stringify(allWines, null, 2)
  );
});

const getWinesFromList = ($: cheerio.CheerioAPI) => {
  return $("ul.products > li")
    .map((i, el) => {
      const $el = $(el);

      const isVegan =
        $el.find(".status").text().includes("Not Vegan") === false;

      const wineLink = $el.find(".name a");
      const makerLink = $el.find(".byline a");

      const url = wineLink.attr("href");
      const name = wineLink.text();

      const maker = makerLink.text();
      const makerUrl = makerLink.attr("href");

      // a bit gross, but grabbing the location from the text because
      // it's not contained in a dom element
      const location = makerLink
        .parent()
        .text()
        ?.split(maker + ",")[1]
        ?.split("\n")[0]
        .trim();

      return {
        maker,
        name,
        location,
        isVegan,
        url,
        makerUrl,
      };
    })
    .toArray();
};

export {};
