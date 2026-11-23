/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 */

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/layout';
import AdventureCard from '../components/adventure-card';
import aemHeadlessClient from '../lib/aem-headless-client';

export default function Adventures() {
  const [adventures, setAdventures] = useState(null);
  const [error, setError] = useState(null);

  // Fetched in the browser on every visit so content changes in AEM show up without a rebuild
  useEffect(() => {
    aemHeadlessClient
      .getAllAdventures({ imageFormat: 'PNG', imageWidth: 262, imageQuality: 80 })
      .then((res) => setAdventures(res?.data?.adventureList?.items || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Layout>
      <Head>
        <title>Adventures</title>
      </Head>
      <section className="bg-white">
          <div className="max-w-2xl mx-auto py-10 px-4 sm:py-16 sm:px-6 lg:max-w-7xl lg:px-8">
            <h2 className="text-2xl font-light tracking-tight text-gray-900">What <u><strong>your</strong></u> next adventure?</h2>
            {error && <p className="mt-6 text-red-600">Could not load adventures: {error}</p>}
            {!adventures && !error && <p className="mt-6 text-gray-500">Loading adventures…</p>}
            {adventures && !adventures.length && <p className="mt-6 text-gray-500">No adventures found.</p>}
            <div className="mt-6 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
              {(adventures || []).map(
                ({
                  _path,
                  slug,
                  title,
                  price,
                  tripLength,
                  primaryImage,
                }, index) => {
                  return (
                    <AdventureCard
                      key={index}
                      path={_path}
                      slug={slug}
                      title={title}
                      price={price}
                      duration={tripLength}
                      imageSrc={aemHeadlessClient.imageUrl(primaryImage)}
                    />
                  );
                }
              )}
            </div>
          </div>
      </section>
    </Layout>
  );
}
