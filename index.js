const express = require('express');
const puppeteer = require('puppeteer');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');
const app = express();
const port = 3001;


app.get('/healthz', (req, res) => {
  res.status(200).send();
});

app.get('/api', async (_, res) => {
  const data = await getData();
  res.status(200).json(data)
});


const server = app.listen(port, () => {
  console.log(`app is listening on port ${port}`)
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

async function getData() {
  const browser = await puppeteer.launch({headless: "new"});
  const page = await browser.newPage();
  let productList = [];

  page.setViewport({
    width: 1080,
    height: 1080,
  });

  const maleProducts = await getCategory('men', page);
  const womenProducts = await getCategory('women', page);

  browser.close();
  productList = [...maleProducts, ...womenProducts];
  const brands = [...new Set(productList.map((prd) => prd.brand))];

  console.log({
    brands: brands.length,
    products: productList.length,
  })

  return {
    brands,
    productList,
  };
}



async function getCategory(category, page) {
  let productList = [];
  let pageIndex = 1;

  await new Promise((resolve, reject) => {

    async function goToPage() {
      // scroll page down to footer;
      const baseUrl = `https://www.farfetch.com/en-EN/shopping/${category}/ekademe/items.aspx?page=${pageIndex}&view=96&sort=3&scale=282`;
      await page.goto(baseUrl);

      await scrollPageToBottom(page, {
        size: 500,
        delay: 250
      })
      const isLastPage = await page.$eval('[data-testid="page-next"]', element=> element.getAttribute("aria-hidden"))

      if (isLastPage === 'false') {
        pageIndex = pageIndex + 1;
        const pageProducts = await getAllItems(page);
        // then
        productList = [...productList, ...pageProducts];
        page.goto(`https://www.farfetch.com/nl/shopping/Men/ekademe/items.aspx?page=${pageIndex}&view=96&sort=3&scale=282`).then(() => goToPage());
      } else {
        // last page
        resolve();
      }
      return productList;
    }

    return goToPage();
  });

  return productList;
}

async function getAllItems(page) {
  const items = await page.$$('[data-testid="productArea"] li[data-testid="productCard"]');
  let productItems = [];

  for(i = 0; i < items.length; i++) {
    const currentEl = items[i]; 
    const prod = {};
  
    let priceEl = await currentEl.$('[data-component="Price"]');

    if (!priceEl) {
      priceEl = await currentEl.$('[data-component="PriceBrief"]');
    }

    const price = await (await priceEl.getProperty('textContent')).jsonValue();

    const titleEl = await currentEl.$('[data-component="ProductCardDescription"]');
    const title = await (await titleEl.getProperty('textContent')).jsonValue();

    const imageEl = await currentEl.$('[data-component="ProductCardImagePrimary"]');
    const image = await (await imageEl.getProperty('src')).jsonValue();

    const brandEl = await currentEl.$('[data-component="ProductCardBrandName"]');
    const brand = await (await brandEl.getProperty('textContent')).jsonValue();

    const sizesEl = await currentEl.$('[data-component="ProductCardSizesAvailable"]');
    const sizes = await (await sizesEl.getProperty('textContent')).jsonValue();

    prod.price = price;
    prod.title = title;
    prod.image = image;
    prod.brand = brand;
    prod.sizes = sizes;

    productItems.push(prod);
  }

  return productItems;
}
