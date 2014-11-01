(function() {
	'use strict';

	function isEmptyCollection(coll) {
		if(!coll) return true;
		if(angular.isArray(coll)) {
			return coll.length === 0;
		}
		else if(angular.isObject(coll)) {
			return Object.keys(coll).length === 0;
		}
		return true;
	}

	function controlScroll(func, wait) {
		var lastScrollTime = 0,
			timer, context;

		return function controlledScroll() {
			var now = new Date();
			context = this;

			if(!timer) {
				if(now - lastScrollTime > wait) {
					func.apply(context, arguments);
					lastScrollTime = now;
				}

				timer = setTimeout(function() {
					timer = null;
					lastScrollTime = new Date();
					func.apply(context, arguments);
				}, wait);
			}

		};
	}


	angular
		.module('paperDom', [])

		.filter('slice', function() {
		    return function(arr, start, end) {
		    	return (arr || []).slice(start, end);
		  	};
		})
		
		.directive('paperDom', ['$timeout', '$rootScope', '$filter', '$interpolate',
			function($timeout, $rootScope, $filter, $interpolate) {

				var CONTAINER_OVERFLOW_FACTOR = 1,
					INITIAL_ITEM_RENDER_COUNT = 30,
					EXTRA_VIEWPORT_FACTOR = 1,
					localCollectionChange = false,
					upDummyContainer = document.createElement('div'),
					downDummyContainer = document.createElement('div'),
					lastVisibleItemRef = INITIAL_ITEM_RENDER_COUNT,
					start = 0,
					end = 0,
					scrollPosition = 0,
					allElementsRendered = false,
					collectionName;

				return {
					restrict : 'A',
					controller : ['$scope', function($scope) {
						this.originalCollection = [];

						this.safeApply = function(func) {
							if($scope.$$phase || $rootScope.$$phase) {
								func();
							}
							else {
								$scope.$apply(func);
							}
						};

						this.refreshCollection = function(start, end) {
							this.safeApply(function() {
								// $scope[collectionName] = $ctrl.fetch(start, end);
								localCollectionChange = true;
								$scope.sliceStart = start;
								$scope.sliceEnd = end;

								setTimeout(function() { localCollectionChange = false; }, 100);

							});
						};

					}],
					compile : function paperDomCompile($tElem, $tAttrs) {
						console.log('COMPILE');

						var repeatElemValues, repeatElem, repeatAttr, match, collectionExpr, trackByExpr, lhs, aliasAs;
						var	PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;

						repeatElemValues = findRepeatElement($tElem[0]);

						repeatElem = repeatElemValues[0];
						repeatAttr = repeatElemValues[1];
						match = repeatAttr.value.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
						lhs = match[1];
						collectionExpr = match[2];
						aliasAs = match[3];
						trackByExpr = match[4];
						collectionName = collectionExpr.match(/^\s*([\s\S]+?)(?:\s+\|\s+([\s\S]+?))?$/)[1];
						console.log(collectionName, collectionExpr);
						repeatElem.setAttribute(repeatAttr.name, lhs + ' in ' + collectionExpr + ' | slice:sliceStart:sliceEnd ' + ' track by ' + trackByExpr);

						function findRepeatElement(node) {
							var childElements = node.getElementsByTagName('*'),
								nAttr, elem;

							for(var i = 0, n = childElements.length; i < n; i++) {								
								for(var ii = 0, elem = childElements[i], attributes = elem.attributes, nn = attributes.length; ii < nn; ii++) {
									nAttr = attributes[ii].name.replace(PREFIX_REGEXP, '').toLowerCase();
									if(/^(ng\Srepeat)$/.test(nAttr) || /^(ng\Srepeat\Sstart)$/.test(nAttr)) {
										return [elem, attributes[ii]];
									}
								}
							}
																		
						}

						return {
							pre : function paperDomPreLink($scope, $element, $attrs, $ctrl, $transclude) {
								
								$scope.$watchCollection(collectionExpr, watchCollectionAction);

								function watchCollectionAction(collection) {
									if(isEmptyCollection(collection)) return;
									console.log('COLLECTION CHANGED PAPERDOM');

									if(!localCollectionChange) {
										$ctrl.originalCollection = collection;
										lastVisibleItemRef = INITIAL_ITEM_RENDER_COUNT;
										start = 0;
										end = 0;
										scrollPosition = 0;
										allElementsRendered = false;

										upDummyContainer.style.height = '0px';
										downDummyContainer.style.height = '0px';

										$ctrl.refreshCollection(0, INITIAL_ITEM_RENDER_COUNT);
									}

									
								}

							},
							post : function paperDomPostLink($scope, $element, $attrs, $ctrl, $transclude) {

								var rawElem = $element[0],
									scrollHandlerBusy = false,
									disableUpScroll = false,
									scrollDirection, itemOuterHeight, viewPortItemCount, firstRowElem, lastRowElem;

								$element.on( 'scroll', scrollHandler );

								$element.prepend(upDummyContainer);
								$element.append(downDummyContainer);


								function scrollHandler($event) {
									var overFlowDiff;
									// if(scrollHandlerBusy) return;
									// scrollHandlerBusy = true;

									if(!itemOuterHeight) {
										itemOuterHeight = Math.floor(rawElem.scrollHeight/INITIAL_ITEM_RENDER_COUNT);
										viewPortItemCount = Math.ceil(rawElem.offsetHeight/itemOuterHeight);

										$scope.$on('NGREPEATDONE', function() {
											scrollHandlerBusy = false;
											console.log('Viewport RENDERED')
										});
									}

									if(rawElem.scrollTop > scrollPosition) {
										console.log('scrolling down');
										lastRowElem = rawElem.lastElementChild.previousElementSibling;

										if(!allElementsRendered && rawElem.scrollTop + (rawElem.offsetHeight*(1+CONTAINER_OVERFLOW_FACTOR)) >= rawElem.scrollHeight) {
											//Fetch for down scrolling, container height being incremented
											updateDown();
											
										}
										else if(lastRowElem.getBoundingClientRect().bottom < rawElem.offsetHeight*(1+CONTAINER_OVERFLOW_FACTOR) + itemOuterHeight) {
											//Fetch for down scrolling, no change in container height
											fetchDown();
											
										}
									}
									else {
										console.log('scrolling up');
										firstRowElem =  rawElem.children[1];
										
										if(!disableUpScroll && firstRowElem.getBoundingClientRect().top + rawElem.offsetHeight*CONTAINER_OVERFLOW_FACTOR > itemOuterHeight) {
											//Fetch for up scrolling, no change in container height
											fetchUp();											
										}
										
									}

									scrollPosition = rawElem.scrollTop;
									// scrollHandlerBusy = false;	
									
								}

								function fetchDown() {
									console.log('DOWN FETCH WITHOUT INCREMENT');
									if(lastVisibleItemRef > $ctrl.originalCollection.length) return;

									renderDown();	

									upDummyContainer.style.height = upDummyContainer.offsetHeight + (end - lastVisibleItemRef)*itemOuterHeight + 'px';
									downDummyContainer.style.height = end === $ctrl.originalCollection.length
										? '0px'
										: downDummyContainer.offsetHeight - (end - lastVisibleItemRef)*itemOuterHeight + 'px';

									lastVisibleItemRef = end;
									
								}

								function updateDown() {
									console.log('fetch down');
									if(lastVisibleItemRef > $ctrl.originalCollection.length) return;

									renderDown();

									if(end === $ctrl.originalCollection.length) {
										allElementsRendered = true;
									}										

									if(start > 0) {
										upDummyContainer.style.height = upDummyContainer.offsetHeight + (end - lastVisibleItemRef)*itemOuterHeight + 'px';	
									}
									
									lastVisibleItemRef = end;
									
								}

								function fetchUp() {
									console.log('fetch up');
									if(lastVisibleItemRef < 0) return;

									end = lastVisibleItemRef - viewPortItemCount;
									start = end - 3*viewPortItemCount;
									if(start < 0) {
										start = 0;
										end = 3*viewPortItemCount;
										disableUpScroll = true;
									}

									$ctrl.refreshCollection(start, end);

									upDummyContainer.style.height = start === 0
										? '0px'
										: upDummyContainer.offsetHeight - (lastVisibleItemRef - end)*itemOuterHeight + 'px';
									downDummyContainer.style.height = downDummyContainer.offsetHeight + (lastVisibleItemRef - end)*itemOuterHeight + 'px';

									lastVisibleItemRef = end;									
								}

								function renderDown() {
									if(disableUpScroll) {
										disableUpScroll = false;
									}

									if(start === 0 && rawElem.children.length - 2 < viewPortItemCount*3) {
										end = viewPortItemCount*3;
									}
									else {
										end = lastVisibleItemRef + viewPortItemCount;
										if(end >= $ctrl.originalCollection.length) {
											end = $ctrl.originalCollection.length;
										}
										start = end - 3*viewPortItemCount;
									}

									$ctrl.refreshCollection(start, end);
								}			

							}
						};
					}
				}
			}
		]);

}());