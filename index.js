require([
  "dojo/ready",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/connect",
  "dojo/_base/array",
  "dojo/aspect",
  "dojo/query",
  "dojo/json",
  "dojo/on",
  "dojo/mouse",
  "dojo/dom",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/_base/Deferred",
  "dojo/DeferredList",
  "dojo/data/ObjectStore",
  "dojo/store/Memory",
  "dojo/store/Observable",
  "dgrid/OnDemandList",
  "dgrid/OnDemandGrid",
  "dgrid/extensions/ColumnHider",
  "dgrid/Selection",
  "dgrid/extensions/DijitRegistry",
  "put-selector/put",
  "dojo/date/locale",
  "dijit/Dialog",
  "dijit/popup",
  "dijit/TooltipDialog",
  "dijit/registry",
  "esri/request",
  "esri/kernel",
  "esri/config",
  "esri/urlUtils",
  "esri/arcgis/utils",
  "esri/arcgis/Portal",
  "esri/IdentityManager"
],function(ready,declare,lang,connect,array,aspect,query,json,on,mouse,dom,domConstruct,domClass,Deferred,DeferredList,ObjectStore,Memory,Observable,OnDemandList,OnDemandGrid,ColumnHider,Selection,DijitRegistry,put,locale,Dialog,popup,TooltipDialog,registry,esriRequest,esriKernel,esriConfig,urlUtils,arcgisUtils,esriPortal,IdentityManager){

  var portalUser;
  var sourceFoldersList = null;
  var sourceGroupsList = null;
  var sourceItemList = null;
  var getFolderItemsDeferred = null;
  var getGroupItemsDeferred = null;

  ready(function(){

    // PROXY URL //
    esriConfig.defaults.io.proxyUrl = "./resources/proxy.ashx";

    // PORTAL //
    var portalUrl = document.location.protocol + '//www.arcgis.com';
    var portal = new esriPortal.Portal(portalUrl);
    // PORTAL LOADED //
    connect.connect(portal,'onLoad',lang.hitch(this,function(){

      // FOLDERS LIST //
      sourceFoldersList = declare([OnDemandList,Selection])({
        store: new Observable(new Memory({
          data: []
        })),
        loadingMessage: "Loading folders...",
        noDataMessage: "ArcGIS.com Folders",
        selectionMode: "single",
        allowTextSelection: false,
        renderRow: renderFolderRow
      },"sourceFoldersList");
      sourceFoldersList.startup();
      sourceFoldersList.on("dgrid-select",sourceFolderSelected);

      // GROUPS LIST //
      sourceGroupsList = declare([OnDemandList,Selection])({
        store: new Observable(new Memory({
          data: []
        })),
        loadingMessage: "Loading groups...",
        noDataMessage: "ArcGIS.com Groups",
        selectionMode: "single",
        allowTextSelection: false,
        renderRow: renderGroupRow
      },"sourceGroupList");
      sourceGroupsList.startup();
      sourceGroupsList.on("dgrid-select",sourceGroupSelected);


      // ITEM LIST //
      sourceItemList = declare([OnDemandGrid,ColumnHider])({
        store: null,
        columns: getColumns(),
        loadingMessage: "Loading items...",
        noDataMessage: "No items found"
      },"sourceItemList");
      sourceItemList.startup();
      sourceItemList.on(".dgrid-row:click",lang.partial(displayItemInAGOL,sourceItemList));
      //sourceItemList.on("dgrid-select",sourceItemSelected);
      aspect.after(sourceItemList,'renderArray',sourceListUpdated,true);

      // FILTER TITLE KEY UP //
      on(registry.byId('sourceItemsFilterInput'),'keyup',filterSourceItems);

      // FILTER TYPE CHANGE //
      on(registry.byId('itemTypeSelect'),'change',filterSourceItems);

      // SOURCE LIST CHANGE //
      on(registry.byId('sourceListController'),'selectChild',sourceListChange);

      // EXPORT ITEM LIST //
      on(registry.byId('exportBtn'),'click',exportItemList);


      // SIGN IN //
      portal.signIn().then(lang.hitch(this,function(user){
        portalUser = user;

        dom.byId('loggedInUser').innerHTML = portalUser.fullName;

        // GET USER FOLDERS //
        portalUser.getFolders().then(function(folders){
          // ROOT FOLDER //
          var rootFolder = {
            id: '',
            title: portalUser.username,
            isRoot: true
          };
          // FOLDER STORE //
          var folderStore = new Observable(new Memory({
            data: [rootFolder].concat(folders)
          }));
          // SET LISTS STORE //
          sourceFoldersList.set('store',folderStore);
        });

        // GET USER GROUPS //
        portalUser.getGroups().then(function(groups){
          // GROUPS STORE //
          var groupStore = new Observable(new Memory({
            data: groups
          }));
          // SET LISTS STORE //
          sourceGroupsList.set('store',groupStore);
        });

      }));

    }));

    function getColumns(){
      var columns = [];
      columns.push({
        needsQuotes: true,
        label: "Thumbnail",
        field: "thumbnailUrl",
        hidden: true,
        renderCell: renderItemThumbnail
      });
      columns.push({
        needsQuotes: true,
        label: "Title",
        field: "title",
        unhidable: true,
        renderCell: renderItemTitle
      });
      columns.push({
        needsQuotes: true,
        label: "ID",
        field: "id",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Credits",
        field: "accessInformation",
        hidden: false
      });
      columns.push({
        needsQuotes: true,
        label: "Access",
        field: "licenseInfo",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Shared",
        field: "access",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Summary",
        field: "snippet",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Description",
        field: "description",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Type",
        field: "type",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Type Keywords",
        field: "typeKeywords",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Tags",
        field: "tags",
        hidden: true
      });
      columns.push({
        needsQuotes: true,
        label: "Created",
        field: "created",
        hidden: true,
        formatter: formatDateValue
      });
      columns.push({
        needsQuotes: true,
        label: "Modified",
        field: "modified",
        hidden: true,
        formatter: formatDateValue
      });
      columns.push({
        needsQuotes: true,
        label: "Owner",
        field: "owner",
        hidden: true
      });
      columns.push({
        needsQuotes: false,
        label: "Avg Rating",
        field: "avgRating",
        hidden: true
      });
      columns.push({
        needsQuotes: false,
        label: "Num Ratings",
        field: "numRatings",
        hidden: true
      });
      columns.push({
        needsQuotes: false,
        label: "Num Views",
        field: "numViews",
        hidden: true
      });
      columns.push({
        needsQuotes: false,
        label: "Num Comments",
        field: "numComments",
        hidden: true
      });

      return columns;
    }

    // RENDER FOLDER ROW //
    function renderFolderRow(object,options){
      var folderClass = object.isRoot ? '.folderItem.rootFolder' : '.folderItem';
      return put("div" + folderClass,object.title);
    }

    // RENDER GROUP ROW //
    function renderGroupRow(object,options){
      return put("div.groupItem",object.title);
    }

    // FORMAT DATES VALUES //
    function formatDateValue(value){
      return (new Date(value)).toLocaleString();
    }

    // FORMAT ITEM THUMBNAIL //
    function renderItemThumbnail(object,value,node,options){
      return value ? put("img.itemThumbnail",{src: value}) : put("span","No Thumbnail");
    }

    // FORMAT ITEM TITLE TO SHOW TYPE ICON //
    function renderItemTitle(object,value,node,options){
      var itemClass = '.icon' + object.type.replace(/ /g,'');
      return put("div.iconItem." + itemClass,value);
    }

    // FILTER SOURCE ITEMS //
    function filterSourceItems(){

      // CLEAR COUNT //
      dom.byId('sourceItemsCount').innerHTML = '';

      // ITEM QUERY //
      var itemQuery = {};

      // TYPE FILTER //
      var itemType = registry.byId('itemTypeSelect').get('value');
      if(itemType !== 'none'){
        itemQuery.type = itemType;
      }

      // TITLE FILTER //
      var itemTitle = registry.byId('sourceItemsFilterInput').get('value');
      if(itemTitle !== ""){
        itemQuery.title = new RegExp(itemTitle,'i');
      }

      // SET QUERY FOR SOURCE ITEM LIST //
      sourceItemList.set('query',itemQuery,{
        count: 1000,
        sort: 'title'
      });
    }

    // UPDATE ITEM COUNT AFTER LIST IS UPDATED //
    function sourceListUpdated(results){
      var counts = {
        store: sourceItemList.store.data.length,
        display: results.total
      };
      dom.byId('sourceItemsCount').innerHTML = lang.replace('{display} of {store}',counts);
      registry.byId('exportBtn').set('disabled',(results.total === 0));
    }

    // UPDATE TYPE LIST //
    function updateTypeList(results){

      var itemTypeNames = [];
      var itemTypes = [
        {
          id: "none",
          label: "<div class='placeHolder'>...no type filter...</div>"
        }
      ];
      array.forEach(results,function(result,resultIndex){
        if(array.indexOf(itemTypeNames,result.type) === -1){
          itemTypeNames.push(result.type);

          var itemClass = 'icon' + result.type.replace(/ /g,'');
          itemTypes.push({
            id: result.type,
            label: lang.replace("<div class='iconItem {0}'>{1}</div>",[itemClass,result.type])
          });
        }
      });

      var objectStore = new ObjectStore({ objectStore: new Memory({
        data: itemTypes
      })});
      registry.byId('itemTypeSelect').setStore(objectStore);

    }

    // SOURCE LIST CHANGED //
    function sourceListChange(selectedChild){
      dom.byId('sourceItemsCount').innerHTML = '';
      registry.byId('exportBtn').set('disabled',true);
      registry.byId('sourceItemsFilterInput').set('value',"");
      updateTypeList([]);
      sourceGroupsList.clearSelection();
      sourceFoldersList.clearSelection();
      //var emptyStore = new Observable(new Memory({data: []}));
      sourceItemList.set('store',null,{},{count: 1000,sort: 'title'});
    }

    // UPDATE SOURCE ITEM LIST WITH NEW STORE //
    function updateSourceItemList(store){
      registry.byId('sourceItemsFilterInput').set('value',"");
      updateTypeList(store.data);
      sourceItemList.set('store',store,{},{count: 1000,sort: 'title'});
      domClass.remove('sourceItemsCount','searching');
    }

    // SOURCE FOLDER ITEM SELECTED //
    function sourceFolderSelected(evt){
      sourceGroupsList.clearSelection();
      domClass.add('sourceItemsCount','searching');
      dom.byId('sourceItemsCount').innerHTML = 'Searching...';
      sourceItemList.set('store',null);
      var portalFolder = evt.rows[0].data;
      if(portalFolder){
        getFolderItemStore(portalFolder).then(updateSourceItemList);
      }
    }

    // SOURCE GROUP ITEM SELECTED //
    function sourceGroupSelected(evt){
      sourceFoldersList.clearSelection();
      domClass.add('sourceItemsCount','searching');
      dom.byId('sourceItemsCount').innerHTML = 'Searching...';
      sourceItemList.set('store',null);
      var portalGroup = evt.rows[0].data;
      if(portalGroup){
        getGroupItemStore(portalGroup).then(updateSourceItemList);
      }
    }


    // GET ITEM STORE FOR PORTAL FOLDER //
    function getFolderItemStore(portalFolder){
      var deferred = new Deferred();
      if(getFolderItemsDeferred){
        getFolderItemsDeferred.cancel();
      }
      getFolderItemsDeferred = portalUser.getItems(portalFolder.id).then(lang.hitch(this,function(items){
        getFolderItemsDeferred = null;
        var itemStore = new Observable(new Memory({
          data: items
        }));
        deferred.resolve(itemStore);
      }));
      return deferred.promise;
    }

    // GET ITEM STORE FOR PORTAL GROUP //
    function getGroupItemStore(portalGroup){
      var deferred = new Deferred();

      if(getGroupItemsDeferred){
        getGroupItemsDeferred.cancel();
      }

      var queryParams = {
        q: '',
        sortField: 'title',
        sortOrder: 'asc',
        start: 0,
        num: 100
      };
      getGroupItemsDeferred = searchItems(portalGroup,queryParams).then(lang.hitch(this,function(allResults){
        getGroupItemsDeferred = null;
        var itemStore = new Observable(new Memory({
          data: allResults
        }));
        deferred.resolve(itemStore);
      }));

      return deferred.promise;
    }

    /**
     * RECURSIVELY SEARCH UNTIL ALL RESULTS ARE RETURNED
     * NOTE: THIS CALL CAN BE DANGEROUS IF THE QUERY RESULTS
     * IN A VERY LARGE NUMBER OF RESULTS. USE CAUTIOUSLY.
     *
     * @param portalGroup
     * @param queryParams
     * @param allResults
     * @returns {*}
     */
    function searchItems(portalGroup,queryParams,allResults){
      var deferred = new Deferred();

      if(!allResults){
        allResults = [];
      }
      portalGroup.queryItems(queryParams).then(lang.hitch(this,function(response){
        allResults = allResults.concat(response.results);
        if(response.nextQueryParams.start > -1){
          searchItems(portalGroup,response.nextQueryParams,allResults).then(deferred.resolve,deferred.reject);
        } else {
          deferred.resolve(allResults);
        }
      }));

      return deferred.promise;
    }

    // DISPLAY ITEM IN ARCGIS.COM - WILL REQUIRE SIGN-IN //
    function displayItemInAGOL(list,evt){
      var item = list.row(evt).data;
      var agsDetailsUrl = lang.replace("{0}//{1}.{2}/home/item.html?id={3}",[document.location.protocol,portalUser.portal.urlKey,portalUser.portal.customBaseUrl,item.id]);
      window.open(agsDetailsUrl);
    }

    // EXPORT ITEM LIST //
    function exportItemList(){

      // CREATE LIST OF COLUMN TEMPLATES //
      var fieldsTemplateParts = array.filter(sourceItemList.columns,function(column){
        // ONLY USE VISIBLE COLUMNS //
        return (!sourceItemList.isColumnHidden(column.id));
      }).map(function(visibleColumn){
          // CHECK CUSTOM COLUMN ATTRIBUTE //
          return (visibleColumn.needsQuotes) ? '"{' + visibleColumn.field + '}"' : '{' + visibleColumn.field + '}'
        });
      // JOIN USING DELIMITER TO CREATE COLUMN TEMPLATE //
      var fieldsTemplate = fieldsTemplateParts.join(',');

      // GET FULL LIST OF ITEMS DIRECTLY FROM STORE //
      var results = sourceItemList.store.query(sourceItemList.query,{sort:sourceItemList._getSort()});
      // GET ARRAY OF VALUES BASED ON COLUMN TEMPLATE //
      var csvParts = results.map(function(result){
        // REPLACE "null" WITH "" //
        return lang.replace(fieldsTemplate,lang.hitch(result,function(_,key){
          return (this[key] !== null) ? this[key] : "";
        }));
      });
      // JOIN USING NEWLINE TO CREATE CSV CONTENT //
      var csv = csvParts.join('\n');

      // CSV CONTENT NODE //
      var csvContentNode = domConstruct.create('textarea',{
        rows: csvParts.length,
        cols: getMaxLength(csvParts),
        innerHTML: csv
      });

      // DISPLAY CSV CONTENT IN DIALOG //
      var exportDialog = new Dialog({
        title: lang.replace("Export Results: {length} items",results),
        content: csvContentNode
      });
      exportDialog.show();

      // SELECT/HIGHLIGHT CSV CONTENT //
      csvContentNode.focus();
      csvContentNode.select();
    }

    // RETURN LENGTH OF LONGEST STRING //
    function getMaxLength(arr){
      return arr.sort(function(a,b){
        return b.length - a.length
      })[0].length;
    }

  });
});

