<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Landing-page content caches must expire within 10 seconds so admin image, price, and copy edits become visible promptly without disabling caching elsewhere.
- Direct landing-page orders must use the dedicated server function that validates package price and delivery fee against the published landing configuration, so landing-specific free delivery survives the general checkout fee rules without trusting browser values.
