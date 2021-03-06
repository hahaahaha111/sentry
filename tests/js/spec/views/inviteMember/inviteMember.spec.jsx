import React from 'react';
import {shallow, mount} from 'enzyme';
import _ from 'lodash';
import {InviteMember} from 'app/views/settings/organizationMembers/inviteMember';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');
jest.mock('jquery');

describe('CreateProject', function() {
  const baseProps = {
    params: {
      orgId: 'testOrg',
    },
    location: {query: {}},
  };

  const teams = [
    {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
    {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
  ];

  const baseContext = TestStubs.routerContext([
    {
      organization: {
        id: '1',
        slug: 'testOrg',
        teams: [
          {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
          {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
        ],
      },
      location: {query: {}},
    },
  ]);

  beforeEach(function() {
    jest.spyOn(ConfigStore, 'getConfig').mockImplementation(() => ({
      id: 1,
      invitesEnabled: true,
    }));
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/teams/',
      body: teams,
    });
  });

  afterEach(function() {});

  it('should render loading', function() {
    const wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render no team select when there is only one option', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {
            id: '1',
            name: 'member',
            desc: 'a normal member',
            allowed: true,
          },
        ],
      },
    });

    const context = _.cloneDeep(baseContext);

    const team = context.context.organization.teams.slice(0, 1);
    context.context.organization.teams = team;

    const wrapper = mount(<InviteMember {...baseProps} />, context);

    expect(wrapper.state('selectedTeams').size).toBe(1);
    expect(wrapper.state('selectedTeams').has(team[0].slug)).toBe(true);
  });

  it('should use invite/add language based on config', function() {
    jest.spyOn(ConfigStore, 'getConfig').mockImplementation(() => ({
      id: 1,
      invitesEnabled: false,
    }));

    const wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
    wrapper.setState({
      loading: false,
    });

    // Lets just target message
    expect(wrapper.find('TextBlock')).toMatchSnapshot();
  });

  it('should redirect when no roles available', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {
            id: '1',
            name: 'member',
            desc: 'a normal member',
            allowed: false,
          },
        ],
      },
    });

    const pushMock = jest.fn();
    let wrapper = mount(
      <InviteMember
        router={{
          push: pushMock,
          location: {
            pathname: '/settings/testOrg/members/new/',
          },
        }}
        {...baseProps}
      />,
      baseContext
    );

    expect(pushMock).toHaveBeenCalledWith('/settings/testOrg/members/');
    expect(wrapper.state('loading')).toBe(false);

    wrapper = mount(
      <InviteMember
        router={{
          push: pushMock,
          location: {
            pathname: '/organizations/testOrg/members/new/',
          },
        }}
        {...baseProps}
      />,
      baseContext
    );

    expect(pushMock).toHaveBeenCalledWith('/organizations/testOrg/members/');
  });

  it('should render roles when available and allowed, and handle submitting', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });

    const inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 200,
      body: {},
    };

    const mock = MockApiClient.addMockResponse(inviteRequest);

    const wrapper = mount(<InviteMember {...baseProps} />, baseContext);

    expect(wrapper.state('loading')).toBe(false);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    expect(wrapper).toMatchSnapshot();

    node = wrapper.find('.invite-member-submit').first();
    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(false);

    wrapper.setState({email: 'test@email.com, test2@email.com, test3@email.com, '});

    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(true);
    expect(wrapper.state('error')).toBe(undefined);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('shows an error when submitting an invalid email', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });

    const inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 400,
      body: {
        email: ['Enter a valid email address.'],
      },
    };

    const mock = MockApiClient.addMockResponse(inviteRequest);

    const wrapper = mount(<InviteMember {...baseProps} />, baseContext);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    node = wrapper.find('.invite-member-submit').first();
    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(false);

    wrapper.setState({email: 'invalid-email'});

    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(true);
    expect(wrapper.state('error')).toBe(undefined);
    expect(mock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();
    expect(wrapper.state('error')).toBeDefined();
    expect(wrapper.find('.has-error')).toHaveLength(1);
    expect(wrapper.find('.has-error #id-email')).toHaveLength(1);
    expect(wrapper.find('.has-error .error').text()).toBe('Enter a valid email address.');
  });
});
