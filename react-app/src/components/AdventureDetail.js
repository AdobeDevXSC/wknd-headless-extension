/*
Copyright 2022 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/
import React, { useMemo } from 'react';
import { Link, useParams } from "react-router-dom";
import { useAdventureBySlug } from "../api/usePersistedQueries";
import { imageUrl } from "../api/aemHeadlessClient";

import backIcon from '../images/icon-close.svg';
import { mapJsonRichText } from '../utils/renderRichText';
import './AdventureDetail.scss';
import Error from "./Error";
import Loading from "./Loading";

function AdventureDetail() {

    // Read the slug value which is the parameter used to query for the adventure's details
    const { slug } = useParams();
    const queryParameters = useMemo(() => ({ format: 'JPG', preferWebp: true, width: 1200}), []);
    // Query AEM for the Adventures's details, using the `slug`
    const { adventure, references, error } = useAdventureBySlug(slug, queryParameters);

    // Handle error and loading conditions
    if (error) {
        return <Error errorMessage={error} />;
    } else if (!adventure) {
        return <Loading />;
    }

    return (<div className="adventure-detail">
        <Link className="adventure-detail-close-button"  to="/">
            <img className="Backbutton-icon" src={backIcon} alt="Return" />
        </Link>
        <AdventureDetailRender {...adventure} references={references} />
    </div>);

}

function AdventureDetailRender({ _path,
    title,
    primaryImage,
    activity,
    adventureType,
    tripLength,
    groupSize,
    difficulty,
    price,
    description,
    itinerary,
    references }) {

    const relatedAdventures = (references || []).filter(reference =>
        reference.__typename === 'AdventureModel' && reference.slug && reference._path !== _path
    );

    return (<div data-aue-resource={`urn:aemconnection:${_path}/jcr:content/data/master`}
        data-aue-type="reference" data-aue-label={title}>
        <h1 className="adventure-detail-title" data-aue-prop="title" data-aue-type="text">{title}</h1>
        <div className="adventure-detail-info">
            <div className="adventure-detail-info-label">Activity</div>
            <div className="adventure-detail-info-description" data-aue-prop="activity" data-aue-type="text">{activity}</div>
            <div className="adventure-detail-info-label">Type</div>
            <div className="adventure-detail-info-description" data-aue-prop="adventureType" data-aue-type="text">{adventureType}</div>
            <div className="adventure-detail-info-label">Trip Length</div>
            <div className="adventure-detail-info-description" data-aue-prop="tripLength" data-aue-type="text">{tripLength}</div>
            <div className="adventure-detail-info-label">Group Size</div>
            <div className="adventure-detail-info-description" data-aue-prop="groupSize" data-aue-type="text">{groupSize}</div>
            <div className="adventure-detail-info-label">Difficulty</div>
            <div className="adventure-detail-info-description" data-aue-prop="difficulty" data-aue-type="text">{difficulty}</div>
            <div className="adventure-detail-info-label">Price</div>
            <div className="adventure-detail-info-description" data-aue-prop="price" data-aue-type="text">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)}
            </div>
        </div>
        <div className="adventure-detail-content">
            <img className="adventure-detail-primaryimage"
                src={imageUrl(primaryImage)} alt={title} data-aue-prop="primaryImage" data-aue-type="media" />
            <div data-aue-prop="description" data-aue-type="richtext">{mapJsonRichText(description.json, customRenderOptions(references))}</div>
            <h2>Itinerary</h2>
            <hr />

            {/* Render the itinerary without any custom render options (just use defaults) */}
            <div className="adventure-detail-itinerary" data-aue-prop="itinerary" data-aue-type="richtext">{mapJsonRichText(itinerary.json)}</div>
        </div>
        {relatedAdventures.length > 0 && (
            <section className="adventure-detail-related" aria-labelledby="related-adventures-title">
                <h2 id="related-adventures-title">Related adventures</h2>
                <ul>
                    {relatedAdventures.map(related => (
                        <RelatedAdventure key={related._path || related.slug} adventure={related} />
                    ))}
                </ul>
            </section>
        )}
    </div>
    );
}

function RelatedAdventure({ adventure }) {
    const queryParameters = useMemo(() => ({ format: 'JPG', preferWebp: true, width: 360 }), []);
    const { adventure: details, error } = useAdventureBySlug(adventure.slug, queryParameters);
    const src = imageUrl(details?.primaryImage);

    return (
        <li>
            <Link className="adventure-detail-related-link" to={`/adventure/${encodeURIComponent(adventure.slug)}`} aria-label={adventure.title}>
                <div className="adventure-detail-related-image">
                    {src ? <img src={src} alt="" loading="lazy" /> : (
                        <span>{error ? 'Image unavailable' : details ? 'No image available' : 'Loading image...'}</span>
                    )}
                </div>
                <div className="adventure-detail-related-info">
                    <span>{adventure.title}</span>
                    {adventure.price != null && (
                        <span>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(adventure.price)}
                        </span>
                    )}
                </div>
            </Link>
            {error && <p role="alert">Could not load image: {error}</p>}
        </li>
    );
}

/**
 * Example of using a custom render for in-line references in a multi line field
 */
function customRenderOptions(references) {

    const renderReference = {
        // node contains merged properties of the in-line reference and _references object
        'ImageRef': (node) => {
            // when __typename === ImageRef
            return <img src={node._path} alt={'in-line reference'} />
        },
        'AdventureModel': (node) => {
            // when __typename === AdventureModel
            return <Link to={`/adventure:${node.slug}`}>{`${node.title}: ${node.price}`}</Link>;
        }
    };

    return {
        nodeMap: {
            'reference': (node, children) => {

                // variable for reference in _references object
                let reference;

                // asset reference
                if (references && node.data.path) {
                    // find reference based on path
                    reference = references.find(ref => ref._path === node.data.path);
                }
                // Fragment Reference
                if (references && node.data.href) {
                    // find in-line reference within _references array based on href and _path properties
                    reference = references.find(ref => ref._path === node.data.href);
                }

                // if reference found return render method of it
                return reference ? renderReference[reference.__typename]({ ...reference, ...node }) : null;
            }
        },
    };
}

export default AdventureDetail;
