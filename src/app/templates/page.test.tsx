import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicTemplatesPage from './page';

describe('PublicTemplatesPage', () => {
  it('renders catalog page with templates list', async () => {
    const Component = await PublicTemplatesPage();
    render(Component);

    expect(screen.getByText('Portfolio OS')).toBeInTheDocument();
    expect(screen.getByText(/Template Portofolio/i)).toBeInTheDocument();
    expect(screen.getByText('macOS Desktop Simulator')).toBeInTheDocument();
    expect(screen.getByText('Modern Bento Landing')).toBeInTheDocument();
  });
});
