import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { StoreLogoService } from './store-logo.service';

/**
 * A store's logo in a small rounded tile, or a storefront glyph when the store has no logo
 * (or the image fails to load). Same look as the logos on the Stores page.
 */
@Component({
  selector: 'app-store-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span class="logo" [style.width.px]="size()" [style.height.px]="size()">
      @if (url() && failedUrl() !== url()) {
        <img [src]="url()" [alt]="name() ?? ''" loading="lazy" (error)="failedUrl.set(url())" />
      } @else {
        <mat-icon>storefront</mat-icon>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex: none; vertical-align: middle; }
    .logo { border-radius: 8px; border: 1px solid var(--rt-divider); display: grid; place-items: center;
            overflow: hidden; background: #fff; }
    img { width: 100%; height: 100%; object-fit: contain; }
    mat-icon { color: var(--rt-muted); font-size: 18px; width: 18px; height: 18px; }
  `,
})
export class StoreLogoComponent {
  private readonly logos = inject(StoreLogoService);

  /** The store name as printed on the receipt. */
  readonly name = input<string | null | undefined>(null);
  readonly size = input(28);

  /** The URL that last failed to load; a new URL (logo replaced) gets a fresh try. */
  protected readonly failedUrl = signal<string | null>(null);
  protected readonly url = computed(() => this.logos.urlFor(this.name()));

  constructor() {
    this.logos.ensureListening();
  }
}
