(function() {
	'use strict';

	angular
		.module('longList', ['paperDom', 'sf.virtualScroll'])
		.controller('AppController', AppController);

		AppController.$inject = ['$scope', '$timeout'];

		function AppController($scope, $timeout) {
			$scope.collection = [];
			$scope.searchKey = '';

			var items = ['Apple', 'Banana', 'Cherry', 'Grapes', 'Mango', 'Pomegranate', 'Raspberry'];

			$scope.generate = function() {
				for(var i = 0; i < 201; i++) {
					$scope.collection.push({
						title : items[i%7] + i,
						price : (10 + i)%100,
						timestamp : i*12345,
						quantity : i%50,
						available : (i%2 === 0) ? 'yes' : 'no'
					});
				}
			};			
		}
}());