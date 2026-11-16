import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        errs=[]
        pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error","warning") else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto("http://localhost:8765/index.html")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path="tests/shots/00_welcome.png")
        print("hash", await pg.evaluate("location.hash"))
        print("\n".join(errs) or "no errors")
        await b.close()
asyncio.run(main())
