import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdventureDetail from './AdventureDetail';
import { useAdventureBySlug } from '../api/usePersistedQueries';

jest.mock('../api/usePersistedQueries', () => ({
    useAdventureBySlug: jest.fn(),
}));
jest.mock('../api/aemHeadlessClient', () => ({
    imageUrl: image => image?._path,
}));
jest.mock('../utils/renderRichText', () => ({
    mapJsonRichText: () => 'Adventure content',
}));

const adventure = {
    _path: '/content/dam/current',
    slug: 'current',
    title: 'Current adventure',
    price: 100,
    description: { json: [] },
    itinerary: { json: [] },
};
const related = {
    __typename: 'AdventureModel',
    _path: '/content/dam/gastronomic-marais-tour',
    slug: 'gastronomic-marais-tour',
    title: 'Gastronomic Marais Tour',
    price: 95,
};

function renderDetail(references, relatedResult = { adventure: null }) {
    useAdventureBySlug.mockImplementation(slug =>
        slug === adventure.slug ? { adventure, references } : relatedResult
    );
    return render(
        <MemoryRouter initialEntries={['/adventure/current']}>
            <Routes>
                <Route path="/adventure/:slug" element={<AdventureDetail />} />
            </Routes>
        </MemoryRouter>
    );
}

test('shows a related adventure image from its fetched primaryImage path', () => {
    const path = '/content/dam/related-image.jpg';
    renderDetail([related], {
        adventure: { primaryImage: { _path: path, _dynamicUrl: 'https://dynamic.example/image.webp' } },
    });
    const section = screen.getByRole('region', { name: 'Related adventures' });
    const link = within(section).getByRole('link', { name: related.title });
    expect(within(link).getByAltText('')).toHaveAttribute('src', path);
    expect(within(link).getByAltText('')).toHaveAttribute('loading', 'lazy');
    expect(useAdventureBySlug).toHaveBeenCalledWith(related.slug, expect.any(Object));
});

test('keeps the related adventure link visible while its image loads', () => {
    renderDetail([related]);
    const section = screen.getByRole('region', { name: 'Related adventures' });
    expect(within(section).getByText('Loading image...')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: related.title }))
        .toHaveAttribute('href', '/adventure/gastronomic-marais-tour');
});

test('shows image request errors without replacing the main adventure', () => {
    renderDetail([related], { adventure: null, error: 'Request failed' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load image: Request failed');
    expect(screen.getByRole('heading', { level: 1, name: adventure.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: related.title })).toBeInTheDocument();
});

test('shows a placeholder when the related adventure has no image', () => {
    renderDetail([related], { adventure: {} });
    expect(screen.getByText('No image available')).toBeInTheDocument();
});

test('shows referenced adventures with prices and working detail links', () => {
    renderDetail([
        related,
        { ...related, _path: '/content/dam/free', slug: 'free', title: 'Free adventure', price: 0 },
        { ...related, _path: '/content/dam/no-price', slug: 'no-price', title: 'Unpriced adventure', price: null },
        { ...adventure, __typename: 'AdventureModel' },
        { __typename: 'ImageRef', _path: '/content/dam/image.jpg' },
        { ...related, slug: null },
    ]);
    const section = screen.getByRole('region', { name: 'Related adventures' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section).getByText('$95.00')).toBeInTheDocument();
    expect(within(section).getByText('$0.00')).toBeInTheDocument();
    expect(within(section).queryByText('Current adventure')).not.toBeInTheDocument();
    const link = within(section).getByRole('link', { name: related.title });
    expect(link).toHaveAttribute('href', '/adventure/gastronomic-marais-tour');

    useAdventureBySlug.mockReturnValue({
        adventure: { ...adventure, ...related },
        references: [],
    });
    fireEvent.click(link);
    expect(screen.getByRole('heading', { level: 1, name: related.title })).toBeInTheDocument();
    expect(useAdventureBySlug).toHaveBeenLastCalledWith(related.slug, expect.any(Object));
    expect(screen.queryByRole('region', { name: 'Related adventures' })).not.toBeInTheDocument();
});

test.each([undefined, null, [], [{ __typename: 'ImageRef' }]])(
    'hides related adventures when there are no adventure references: %j',
    references => {
        renderDetail(references);
        expect(screen.queryByRole('region', { name: 'Related adventures' })).not.toBeInTheDocument();
    }
);
