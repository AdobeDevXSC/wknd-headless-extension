import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { useRouter } from 'next/router';
import Adventure from '../pages/adventure';
import aemHeadlessClient from './aem-headless-client';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/head', () => () => null);
jest.mock('next/link', () => {
  return function Link({ href, children, ...props }) {
    return <a href={href} {...props}>{children}</a>;
  };
});
jest.mock('../components/layout', () => {
  return function Layout({ children }) {
    return <main>{children}</main>;
  };
});
jest.mock('./aem-headless-client', () => ({
  __esModule: true,
  default: { getAdventuresBySlug: jest.fn(), imageUrl: image => image?._path },
}));

const adventure = {
  _path: '/content/dam/current',
  title: 'Current adventure',
  price: 100,
  description: { html: '<p>Description</p>' },
  itinerary: { html: '<p>Itinerary</p>' },
};
const related = {
  __typename: 'AdventureModel',
  _path: '/content/dam/gastronomic-marais-tour',
  slug: 'gastronomic-marais-tour',
  title: 'Gastronomic Marais Tour',
  price: 95,
};

function response(item, references) {
  return { data: { adventureList: { items: [item], _references: references } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  aemHeadlessClient.getAdventuresBySlug.mockReset();
  aemHeadlessClient.getAdventuresBySlug.mockResolvedValue(response(adventure, []));
  useRouter.mockReturnValue({ isReady: true, query: { slug: 'current' } });
});

test('fetches a related adventure image while keeping its link visible', async () => {
  let resolveImage;
  aemHeadlessClient.getAdventuresBySlug
    .mockResolvedValueOnce(response(adventure, [related]))
    .mockReturnValueOnce(new Promise(resolve => { resolveImage = resolve; }));
  render(<Adventure />);
  const section = await screen.findByRole('region', { name: 'Related adventures' });
  const link = within(section).getByRole('link', { name: related.title });
  expect(within(link).getByText('Loading image...')).toBeInTheDocument();
  expect(aemHeadlessClient.getAdventuresBySlug).toHaveBeenCalledWith(related.slug, expect.any(Object));

  const path = '/content/dam/related-image.jpg';
  await act(async () => {
    resolveImage(response({
      primaryImage: { _path: path, _dynamicUrl: 'https://dynamic.example/image.webp' },
    }, []));
  });
  expect(within(link).getByAltText('')).toHaveAttribute('src', path);
  expect(within(link).getByAltText('')).toHaveAttribute('loading', 'lazy');
  expect(within(link).queryByText('Loading image...')).not.toBeInTheDocument();
});

test('shows related image errors without replacing the main adventure', async () => {
  aemHeadlessClient.getAdventuresBySlug
    .mockResolvedValueOnce(response(adventure, [related]))
    .mockRejectedValueOnce(new Error('Request failed'));
  render(<Adventure />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load image: Request failed');
  expect(screen.getByRole('heading', { level: 1, name: adventure.title })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: related.title })).toBeInTheDocument();
});

test('shows a placeholder when the related adventure has no image', async () => {
  aemHeadlessClient.getAdventuresBySlug
    .mockResolvedValueOnce(response(adventure, [related]))
    .mockResolvedValueOnce(response({}, []));
  render(<Adventure />);
  expect(await screen.findByText('No image available')).toBeInTheDocument();
});

test('shows only other adventure references with detail links and prices', async () => {
  aemHeadlessClient.getAdventuresBySlug.mockResolvedValue(response(adventure, [
    related,
    { ...related, _path: '/content/dam/free', slug: 'free', title: 'Free adventure', price: 0 },
    { ...related, _path: '/content/dam/no-price', slug: 'no-price', title: 'Unpriced adventure', price: null },
    { ...adventure, __typename: 'AdventureModel', slug: 'current' },
    { __typename: 'ImageRef', _path: '/content/dam/image.jpg' },
    { ...related, slug: null },
  ]));
  render(<Adventure />);
  const section = await screen.findByRole('region', { name: 'Related adventures' });
  expect(within(section).getAllByRole('listitem')).toHaveLength(3);
  expect(within(section).getByRole('link', { name: related.title }))
    .toHaveAttribute('href', '/adventure?slug=gastronomic-marais-tour');
  expect(within(section).getByText('$95 USD')).toBeInTheDocument();
  expect(within(section).getByText('$0 USD')).toBeInTheDocument();
  expect(within(section).queryByText(adventure.title)).not.toBeInTheDocument();
});

test.each([undefined, null, [], [{ __typename: 'ImageRef' }]])(
  'hides related adventures when there are no adventure references: %j',
  async references => {
    aemHeadlessClient.getAdventuresBySlug.mockResolvedValue(response(adventure, references));
    render(<Adventure />);
    await screen.findByRole('heading', { level: 1, name: adventure.title });
    expect(screen.queryByRole('region', { name: 'Related adventures' })).not.toBeInTheDocument();
  }
);

test('loads the selected related adventure and clears the previous references', async () => {
  aemHeadlessClient.getAdventuresBySlug.mockResolvedValueOnce(response(adventure, [related]));
  const { rerender } = render(<Adventure />);
  await screen.findByRole('region', { name: 'Related adventures' });

  let resolve;
  aemHeadlessClient.getAdventuresBySlug.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  useRouter.mockReturnValue({ isReady: true, query: { slug: related.slug } });
  rerender(<Adventure />);
  expect(screen.queryByRole('region', { name: 'Related adventures' })).not.toBeInTheDocument();
  expect(screen.getByText('Loading adventure…')).toBeInTheDocument();

  resolve(response({ ...adventure, ...related }, []));
  await screen.findByRole('heading', { level: 1, name: related.title });
  expect(aemHeadlessClient.getAdventuresBySlug).toHaveBeenLastCalledWith(related.slug, expect.any(Object));
  expect(screen.queryByRole('region', { name: 'Related adventures' })).not.toBeInTheDocument();
});
