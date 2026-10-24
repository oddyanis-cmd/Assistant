import { qs } from '../util.js';
import { init, fail, setTitle } from '../layout.js';

init().then(() => {
  setTitle('Page not found');
  qs('#main').innerHTML = '<div class="container section"><div class="empty"><h1>We could not find that page</h1><p class="muted">It may have moved, or the link may be mistyped.</p><a class="btn" href="/shop">Browse the shop</a></div></div>';
}).catch(fail);
