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

import AEMHeadless from '@adobe/aem-headless-client-js';
import sessionConfig from './sessionConfig';

export function getAemConfig() {
  return sessionConfig.requireConfig(sessionConfig.appRootPath('next-js'));
}


/**
 * This file defines a singleton that exposes AEM concerns to the rest of the app.
 * This includes:
 * - getters that invoke AEM GraphQL persisted queries
 * - helper functions for resources, such as images, that need to be served from AEM
 */
class AemHeadlessClient {
  /**
   * Create an instance of the AEM Headles Client for JS used to communicate with AEM Headless GraphQL endpoints.
   * 
   * @param {*} config the runtime AEM connection settings.
   */
  getClient(config) {
    return new AEMHeadless(sessionConfig.clientOptions(config));
  }

  /**
   * Generates an absoluate URL resolvable to AEM. This is typically used for images.
   * 
   * @param {*} url 
   * @returns the urlPath prefixd with the AEM service host
   */
  serveFromAem(url) {
    if (url.startsWith("/")) {
      // images always come from Publish, even when the AEM host is Author
      const publishHost = getAemConfig().aemHost.replace('://author-', '://publish-');
      return new URL(url, publishHost).toString();
    }
    return url;  }



  /**
   * Uses the image reference's _path to serve it from AEM.
   *
   * @param {*} image an AEM image reference with _path
   * @returns an absolute image URL, or undefined when there is no image
   */
  imageUrl(image) {
    const url = image?._path;
    return url ? this.serveFromAem(url) : undefined;
  }

  /**
   * Invokes the 'adventures-all` persisted query using the parameterizable namespace.
   * 
   * @returns a GraphQL response of all adventures.
   */
  async getAllAdventures(queryVariables = {}) {
    try {
      const config = getAemConfig();
      return await this.getClient(config).runPersistedQuery(config.graphqlEndpoint + '/adventures-all', queryVariables);
    } catch(e) {
      console.error(e);
      throw e;
    }    
  }

  /**
   * Invokes the 'adventures-all` persisted query using the parameterizable namespace.
   * This then collects all the slugs (aka id's) fot the adventures. This is ultimately used to power the SSG of adventure detail pages.
   * 
   * @returns a list of slugs of all adventures. 
   */
  async getAdventureSlugs() {
    let adventures = [];
    try {
      const res = await this.getAllAdventures();
      adventures = res?.data?.adventureList?.items || [];
    } catch(e) {
      console.error(e)
    }
    
    return adventures.map((item) => ({
      params: {
        slug: [item.slug],
      }
    }));
  }

  /**
   * Invokes the 'adventure-by-slug` persisted query using the parameterizable namespace.
   * This is used to power the adventure details page.
   * @param {*} slug the adventure's slug
   * @returns the adventure's details.
   */
  async getAdventuresBySlug(slug, queryVariables = {}) {
    queryVariables = {...queryVariables, 'slug': slug};
    try {
      const config = getAemConfig();
      return await this.getClient(config).runPersistedQuery(config.graphqlEndpoint + '/adventure-by-slug', queryVariables);
    } catch(e) {
      console.error(e);
      throw e;
    }
  }
}

/**
 * Export the initialized AEM Headless client object for use in the Next.js app
 */
export default new AemHeadlessClient();