const readGistAsync = (request, dataLayer, callback) => {
    request('GET',
        '/gists',
        dataLayer.gistToken
    ).then(
        (allGists) => {
            let gistId = '';
            allGists = JSON.parse(allGists);

            for (let i = 0; i < allGists.length; i++) {
                const gist = allGists[i];
                if (gist.public === true) {
                    continue
                }
                if (gist.description === dataLayer.gistName) {
                    gistId = gist.id;
                    break;
                }
            }

            if (gistId === '') {
                return Promise.reject(new Error('Gist not found!'));
            }
            else {
                return request('GET',
                    '/gists/' + gistId,
                    dataLayer.gistToken
                );
            }
        }
    )
        .then((gistResponse) => {
            const response = JSON.parse(gistResponse);

            return Promise.resolve(response.files['data.json'].content);
        })
        .then((result) => { callback(null, result); })
        .catch(callback);
}

const writeGistAsync = (request, dataLayer, data, callback) => {
    request('GET',
        '/gists',
        dataLayer.gistToken
    ).then(
        (allGists) => {
            let gistId = '';
            allGists = JSON.parse(allGists);

            for (let i = 0; i < allGists.length; i++) {
                const gist = allGists[i];
                if (gist.public === true) {
                    continue
                }
                if (gist.description === dataLayer.gistName) {
                    gistId = gist.id;
                    break;
                }
            }

            if (gistId === '') {
                return request(
                    'POST',
                    '/gists',
                    dataLayer.gistToken,
                    dataLayer.gistName,
                    data
                )
            }
            else {
                return request(
                    'PATCH',
                    '/gists/' + gistId,
                    dataLayer.gistToken,
                    dataLayer.gistName,
                    data
                )
            }
        }
    )
        .then((result) => { callback(null, result); })
        .catch(callback);
}

export {
    readGistAsync,
    writeGistAsync
}