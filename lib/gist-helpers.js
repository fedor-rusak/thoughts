const readGistAsync = (request, dataLayer, callback) => {
	request("GET",
			"https://api.github.com/gists",
			dataLayer.gistToken
	).then(
		(allGists) => {
			let gistId = "";
			allGists = JSON.parse(allGists);

			for (let i = 0; i < allGists.length; i++) {
				let gist = allGists[i];
				if (gist.public === true) {
					continue
				}
				if (gist.description === dataLayer.gistName) {
					gistId = gist.id;
					break;
				}
			}

			if (gistId === "") {
				return Promise.reject("Gist not found!");
			}
			else {
				return request("GET",
					"https://api.github.com/gists/"+gistId,
					dataLayer.gistToken
				);
			}
		}
	)
	.then((gistResponse) => {
		let response = JSON.parse(gistResponse);

		return Promise.resolve(response.files["data.json"].content);
	})
	.then((result)=>{callback(null, result);})
	.catch(callback);
}

const writeGistAsync = (request, dataLayer, data, callback) => {
	request("GET",
			"https://api.github.com/gists",
			dataLayer.gistToken
	).then(
		(allGists) => {
			let gistId = "";
			allGists = JSON.parse(allGists);

			for (let i = 0; i < allGists.length; i++) {
				let gist = allGists[i];
				if (gist.public === true) {
					continue
				}
				if (gist.description === dataLayer.gistName) {
					gistId = gist.id;
					break;
				}
			}

			if (gistId === "") {
				return request(
					"POST",
					"https://api.github.com/gists",
					dataLayer.gistToken,
					dataLayer.gistName,
					data
				)
			}
			else {
				return request(
					"PATCH",
					"https://api.github.com/gists/"+gistId,
					dataLayer.gistToken,
					dataLayer.gistName,
					data
				)
			}
		}
	)
	.then((result)=>{callback(null, result);})
	.catch(callback);
}

export {
	readGistAsync,
	writeGistAsync
}