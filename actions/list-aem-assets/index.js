/*
 * <license header>
 */

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const fetch = require('node-fetch')

async function main (params) {
  const logger = Core.Logger('list-aem-assets', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.debug('Input params:', stringParameters(params))

    const requiredParams = ['aemHost', 'folderPath']
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger)
    }

    const token = getBearerToken(params)
    const { aemHost, folderPath } = params

    // Strip leading slash - AEM API path is relative to /api/assets/
    const apiPath = folderPath.replace(/^\//, '')

    // Pagination support via optional params
    const limit = parseInt(params.limit) || 100
    const offset = parseInt(params.offset) || 0

    const apiUrl = `${aemHost}/api/assets/${apiPath}.json?limit=${limit}&offset=${offset}`
    logger.info(`Fetching AEM assets from: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`AEM API error ${response.status}: ${errorText}`)
      return errorResponse(response.status, `AEM Assets API error: ${response.statusText}`, logger)
    }

    const data = await response.json()
    const entities = data.entities || []

    const folders = entities
      .filter(e => Array.isArray(e.class) && e.class.includes('assets/folder'))
      .map(f => ({
        name: f.properties?.name || '',
        title: f.properties?.['dc:title'] || f.properties?.name || '',
        path: `${folderPath.replace(/\/$/, '')}/${f.properties?.name}`
      }))

    const assets = entities
      .filter(e => Array.isArray(e.class) && e.class.includes('assets/asset'))
      .map(a => ({
        name: a.properties?.name || '',
        title: a.properties?.['dc:title'] || a.properties?.name || '',
        format: a.properties?.['dc:format'] || '',
        size: a.properties?.['dam:size'] || 0,
        lastModified: a.properties?.['dam:assetLastModified'] || null,
        created: a.properties?.['jcr:created'] || null,
        path: `${folderPath.replace(/\/$/, '')}/${a.properties?.name}`
      }))

    return {
      statusCode: 200,
      body: {
        currentPath: folderPath,
        folderName: data.properties?.name || folderPath.split('/').pop(),
        folders,
        assets,
        total: data.properties?.srn?.total || entities.length,
        offset,
        limit
      }
    }
  } catch (e) {
    logger.error(e)
    return errorResponse(500, `Server error: ${e.message}`, logger)
  }
}

module.exports = { main }
